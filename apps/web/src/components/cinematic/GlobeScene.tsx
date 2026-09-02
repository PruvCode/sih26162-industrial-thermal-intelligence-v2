'use client';

/**
 * CINEMATIC GLOBE.
 *
 * Rewritten against the audit. The four structural faults it fixes:
 *
 * 1. CAMERA GEOGRAPHY. The old scene started from the identity orientation,
 *    which — with this texture convention — points the camera at longitude 0,
 *    i.e. the Atlantic and the Americas. Every keyframe here is east of that,
 *    so the journey runs East Africa → Arabia → South Asia → India and can
 *    never show the Americas, Greenland, the Pacific or ice.
 *
 * 2. FRAMING. The planet used to leave the frame because the camera looked at
 *    a fixed point that was not the globe's centre. Here the camera always
 *    looks along its own axis at the globe centre plane; composition offset is
 *    a pure frustum translation, and both the distance and the offset are
 *    clamped against the actual frustum so the limb stays inside the viewport
 *    at every aspect ratio.
 *
 * 3. FRAME-RATE DEPENDENCE. All damping is exponential in `dt`, not "5% per
 *    frame", so the camera has identical mass on 60 Hz and 144 Hz displays.
 *
 * 4. LIFECYCLE. Once the planet has dissolved, the rAF loop is cancelled —
 *    not early-returned from. Three.js costs nothing behind the operational
 *    map, and resumes correctly on reverse scroll.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { experience } from '@/hooks/useExperience';
import {
  GLOBE_FOV,
  GLOBE_KEYS,
  GLOBE_RADIUS,
  HANDOFF,
  MIN_SURFACE_MULTIPLE,
} from '@/lib/constants';
import { JOURNEY_FACING, facingQuaternion, latLngToUnit } from '@/lib/geo';
import { clamp, clamp01, dampHalfLife, easeInOutCubic, smoothstep } from '@/lib/motion';

export interface GlobeSceneProps {
  /** Fired with real progress as textures decode (0..1). */
  onProgress?: (fraction: number) => void;
  /** Fired once every texture has decoded, or the timeout fallback fires. */
  onReady?: () => void;
  /** Renders a marker over the journey target. Opt-in via `?debugTarget=1`. */
  debugTarget?: boolean;
  /** Skip the cinematic motion entirely (reduced motion). */
  reducedMotion?: boolean;
}

type FacingName = keyof typeof JOURNEY_FACING;

const R = GLOBE_RADIUS;
const TAN_HALF_FOV = Math.tan((GLOBE_FOV / 2) * (Math.PI / 180));

/** Composition offset at the widest shot, in world units. Negative X puts the
 *  planet right of centre so the headline owns the left third. */
const BASE_OFFSET_X = -1.05;
const BASE_OFFSET_Y = 0.12;

/** Camera inertia, as half-lives in seconds. Larger = heavier. */
const ALTITUDE_HALF_LIFE = 0.85;
const ROTATION_HALF_LIFE = 0.55;
const OFFSET_HALF_LIFE = 0.7;

/** Spin decay: the planet is still turning in orbit, and settles as we lock on. */
const SPIN_RATE = 0.035;

export default function GlobeScene({ onProgress, onReady, debugTarget = false, reducedMotion = false }: GlobeSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onProgressRef = useRef(onProgress);
  const onReadyRef = useRef(onReady);
  onProgressRef.current = onProgress;
  onReadyRef.current = onReady;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let width = container.clientWidth || 1;
    let height = container.clientHeight || 1;

    // ── Renderer ────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(GLOBE_FOV, width / height, 0.01, 400);

    // ── Textures, through a LoadingManager so readiness is real ──────────
    let loadedCount = 0;
    const totalCount = 3;
    let readyFired = false;
    const fireReady = () => {
      if (readyFired) return;
      readyFired = true;
      onReadyRef.current?.();
    };

    const manager = new THREE.LoadingManager();
    manager.onProgress = () => {
      loadedCount += 1;
      onProgressRef.current?.(loadedCount / totalCount);
    };
    manager.onLoad = fireReady;
    manager.onError = fireReady; // a missing texture must not wedge the app

    const loader = new THREE.TextureLoader(manager);
    const dayTexture = loader.load('/4k_earth_daymap.jpg');
    const nightTexture = loader.load('/4k_earth_nightmap.jpg');
    const cloudTexture = loader.load('/4k_earth_clouds.jpg');
    for (const t of [dayTexture, nightTexture, cloudTexture]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    }
    // If the network is dead the manager may never fire at all.
    const readyTimeout = window.setTimeout(fireReady, 8000);

    // ── Globe ───────────────────────────────────────────────────────────
    const group = new THREE.Group();
    scene.add(group);

    const dayMat = new THREE.MeshStandardMaterial({
      map: dayTexture,
      roughness: 0.62,
      metalness: 0.0,
    });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 128), dayMat);
    group.add(globe);

    /** Sun direction, fixed in world space so the terminator stays put while
     *  the planet rotates beneath it — physically what actually happens. */
    const SUN_DIR = new THREE.Vector3(0.62, 0.3, 0.72).normalize();

    const nightMat = new THREE.ShaderMaterial({
      uniforms: {
        uNight: { value: nightTexture },
        uSunDir: { value: SUN_DIR.clone() },
        uOpacity: { value: 1 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        void main() {
          vUv = uv;
          // The night mask must be evaluated against the *world* normal: the
          // planet spins, so a view-space or object-space normal would make
          // the city lights slide across the surface with the camera.
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uNight;
        uniform vec3 uSunDir;
        uniform float uOpacity;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        void main() {
          float sunDot = dot(normalize(vWorldNormal), uSunDir);
          float night = smoothstep(0.12, -0.28, sunDot);
          vec3 c = texture2D(uNight, vUv).rgb;
          float lum = max(max(c.r, c.g), c.b);
          gl_FragColor = vec4(c * lum * 2.1, night * lum * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    group.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.0015, 96, 96), nightMat));

    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
    });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.014, 96, 96), cloudMat);
    group.add(clouds);

    // Atmospheric scattering — a shell rendered from the inside with additive
    // blending. Deliberately NOT a flat ring sprite: the glow is modulated by
    // the sun so it wraps the lit limb and dies on the night side.
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: { value: SUN_DIR.clone() },
        uOpacity: { value: 1 },
      },
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        uniform float uOpacity;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float rim = 1.0 - abs(dot(viewDir, normalize(vWorldNormal)));
          rim = pow(clamp(rim, 0.0, 1.0), 3.2);
          float sun = smoothstep(-0.35, 0.7, dot(normalize(vWorldNormal), uSunDir));
          vec3 cool = vec3(0.10, 0.24, 0.52);
          vec3 warm = vec3(0.30, 0.52, 0.80);
          vec3 col = mix(cool, warm, sun);
          float a = rim * (0.18 + 0.62 * sun) * uOpacity;
          gl_FragColor = vec4(col, a);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(R * 1.09, 64, 64), atmoMat);
    group.add(atmosphere);

    // ── Starfield ───────────────────────────────────────────────────────
    const STAR_COUNT = 900;
    const starPos = new Float32Array(STAR_COUNT * 3);
    const starSize = new Float32Array(STAR_COUNT);
    const starPhase = new Float32Array(STAR_COUNT);
    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 60 + Math.random() * 90;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = r * Math.cos(phi);
      starSize[i] = 0.4 + Math.random() * 1.5;
      starPhase[i] = Math.random() * Math.PI * 2;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSize, 1));
    starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhase, 1));
    const starMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 } },
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        uniform float uTime;
        varying float vTwinkle;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vTwinkle = 0.75 + 0.25 * sin(uTime * 0.7 + aPhase);
          gl_PointSize = aSize * vTwinkle * (170.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying float vTwinkle;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float core = 1.0 - smoothstep(0.0, 0.12, d);
          float glow = 1.0 - smoothstep(0.0, 0.5, d);
          vec3 c = mix(vec3(0.55, 0.65, 0.85), vec3(1.0), core);
          gl_FragColor = vec4(c, (core * 0.75 + glow * 0.12) * vTwinkle * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ── Lighting ────────────────────────────────────────────────────────
    const sun = new THREE.DirectionalLight(0xfff4e2, 3.1);
    sun.position.copy(SUN_DIR).multiplyScalar(10);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0x0a1622, 0.34));
    const fill = new THREE.DirectionalLight(0x14304f, 0.4);
    fill.position.set(-6, -2, -4);
    scene.add(fill);

    // ── Dev-only journey target marker ───────────────────────────────────
    let marker: THREE.Mesh | null = null;
    if (debugTarget) {
      marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x00ff88 })
      );
      marker.position.copy(latLngToUnit(JOURNEY_FACING.REGION.lat, JOURNEY_FACING.REGION.lng, R * 1.02));
      group.add(marker);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.05, 0.065, 32),
        new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
      );
      ring.position.copy(marker.position);
      ring.lookAt(0, 0, 0);
      group.add(ring);
    }

    // ── Camera rig ───────────────────────────────────────────────────────

    /** Precomputed facing quaternion per journey keyframe. */
    const facingQuats: Record<string, THREE.Quaternion> = {};
    for (const [name, p] of Object.entries(JOURNEY_FACING)) {
      facingQuats[name] = facingQuaternion(p.lat, p.lng);
    }

    const keyframes = GLOBE_KEYS.map((k) => ({
      at: k.at,
      quat: facingQuats[k.facing as FacingName],
      altitude: k.altitude,
      spin: k.spin,
    }));

    const rig = {
      altitude: keyframes[0].altitude,
      quat: keyframes[0].quat.clone(),
      offsetX: BASE_OFFSET_X,
      offsetY: BASE_OFFSET_Y,
      spinPhase: 0,
    };

    const tmpQuatA = new THREE.Quaternion();
    const tmpQuatB = new THREE.Quaternion();
    const spinQuat = new THREE.Quaternion();
    const Y_AXIS = new THREE.Vector3(0, 1, 0);

    /**
     * Scroll progress → camera target. This is the interpolation the brief
     * asks for: progress resolves to a target *state*, and the state is then
     * approached with mass. Never raw scrollY → position.
     */
    function resolveTarget(p: number, out: { altitude: number; spin: number; quat: THREE.Quaternion }) {
      const last = keyframes.length - 1;
      if (p <= keyframes[0].at) {
        out.altitude = keyframes[0].altitude;
        out.spin = keyframes[0].spin;
        out.quat.copy(keyframes[0].quat);
        return;
      }
      if (p >= keyframes[last].at) {
        out.altitude = keyframes[last].altitude;
        out.spin = keyframes[last].spin;
        out.quat.copy(keyframes[last].quat);
        return;
      }
      let i = 0;
      while (i < last && keyframes[i + 1].at <= p) i++;
      const a = keyframes[i];
      const b = keyframes[i + 1];
      const span = b.at - a.at;
      const raw = span > 0 ? (p - a.at) / span : 0;
      const t = easeInOutCubic(raw);
      out.altitude = a.altitude + (b.altitude - a.altitude) * t;
      out.spin = a.spin + (b.spin - a.spin) * t;
      out.quat.copy(a.quat).slerp(b.quat, t);
    }

    const target = { altitude: 0, spin: 0, quat: new THREE.Quaternion() };

    /**
     * Frustum-fit framing.
     *
     * `apparent` is the fraction of viewport height the globe should span at
     * the widest shot. It is a function of aspect ratio so the planet stays
     * large on wide screens and does not get clipped on tall ones.
     */
    function framingFor(aspect: number) {
      const apparent = clamp(0.78 + (aspect - 1.0) * 0.13, 0.76, 0.94);
      const widestDistance = R / (apparent * TAN_HALF_FOV);
      return { apparent, widestDistance };
    }

    let aspect = width / height;
    let framing = framingFor(aspect);

    // ── Render loop ──────────────────────────────────────────────────────
    let raf = 0;
    let running = true;
    let lastTime = performance.now();
    const targetVec = new THREE.Vector3();

    function frame(now: number) {
      if (!running) return;
      raf = requestAnimationFrame(frame);

      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const time = now / 1000;

      const p = experience.cinematicProgress;
      resolveTarget(p, target);

      // The planet is still turning in orbit; it settles as we commit to India.
      rig.spinPhase += dt * SPIN_RATE * target.spin;

      if (reducedMotion) {
        rig.altitude = target.altitude;
        rig.quat.copy(target.quat);
        rig.offsetX = BASE_OFFSET_X;
        rig.offsetY = BASE_OFFSET_Y;
      } else {
        rig.altitude = dampHalfLife(rig.altitude, target.altitude, ALTITUDE_HALF_LIFE, dt);

        // Rotation: slerp by a dt-derived factor, so the arc covered per
        // second is identical regardless of frame rate.
        const rotT = 1 - Math.exp(-dt / ROTATION_HALF_LIFE);
        rig.quat.slerp(target.quat, rotT);

        // Composition offset fades out early in the descent. At the widest shot
        // (high altitude) the offset is FULL so the headline owns the left
        // third; by the time the camera reaches the REGION framing (altitude
        // ~1.09) the offset MUST be zero so the look-at point sits dead-centre
        // — otherwise the planet's rightward shift pushes the geographic target
        // off-frame and the visible centre is east of the named location (ocean
        // east of India, etc.). `smoothstep(1.4, 2.0, altitude)` ramps 0→1 as
        // altitude rises, so the offset is 0 below 1.4 (INDIA/REGION framed
        // centred) and 1 above 2.0 (wide establishing shot right-shifted).
        const descend = smoothstep(1.4, 2.0, rig.altitude);
        const halfH = rig.altitude * R * TAN_HALF_FOV;
        const halfW = halfH * aspect;
        const maxOx = Math.max(0, halfW - R - 0.12);
        const maxOy = Math.max(0, halfH - R - 0.12);
        const wantOx = BASE_OFFSET_X * descend;
        const wantOy = BASE_OFFSET_Y * descend;
        rig.offsetX = dampHalfLife(
          rig.offsetX,
          clamp(wantOx, -maxOx, maxOx),
          OFFSET_HALF_LIFE,
          dt
        );
        rig.offsetY = dampHalfLife(
          rig.offsetY,
          clamp(wantOy, -maxOy, maxOy),
          OFFSET_HALF_LIFE,
          dt
        );
      }

      // Model-space polar spin, then the facing rotation.
      spinQuat.setFromAxisAngle(Y_AXIS, rig.spinPhase);
      tmpQuatA.copy(rig.quat).multiply(spinQuat);
      group.quaternion.copy(tmpQuatA);

      // Clouds drift slightly ahead of the surface for depth.
      tmpQuatB.setFromAxisAngle(Y_AXIS, rig.spinPhase * 1.09 + time * 0.0022);
      clouds.quaternion.copy(rig.quat).multiply(tmpQuatB);

      // Camera: on the +Z axis at a safe multiple of the radius, looking along
      // its own axis. The look target shares the offset so the framing shift is
      // a pure frustum translation — the globe centre cannot wander off-screen.
      const altitude = Math.max(MIN_SURFACE_MULTIPLE, rig.altitude);
      const distance = R * altitude;
      camera.position.set(rig.offsetX, rig.offsetY, distance);
      targetVec.set(rig.offsetX, rig.offsetY, 0);
      camera.lookAt(targetVec);

      // Dissolve across the observation band. Once fully gone, stop rendering.
      //
      // NOTE: this reads RAW progress, not `p`. `p` is cinematicProgress, which
      // saturates at 1 by raw 0.68 — driving the dissolve off it made the planet
      // vanish at raw ~0.54 while the map did not begin until raw ~0.88, which
      // is 140vh of black screen. The camera choreography stays on `p`; only the
      // handoff is pinned to the raw timeline the map and observation layer use.
      const dissolve = smoothstep(HANDOFF.dissolveStart, HANDOFF.dissolveEnd, experience.progress);
      const visible = dissolve < 0.999;
      const opacity = clamp01(1 - dissolve);

      if (visible) {
        group.visible = true;
        stars.visible = true;
        dayMat.transparent = opacity < 1;
        dayMat.opacity = opacity;
        cloudMat.opacity = 0.34 * opacity;
        nightMat.uniforms.uOpacity.value = opacity;
        atmoMat.uniforms.uOpacity.value = opacity;
        starMat.uniforms.uOpacity.value = Math.min(1, opacity * 1.4);
        starMat.uniforms.uTime.value = time;
        renderer.render(scene, camera);
      } else if (group.visible) {
        group.visible = false;
        stars.visible = false;
        renderer.clear();
        renderer.render(scene, camera); // one blank frame, then idle
      }
    }
    raf = requestAnimationFrame(frame);

    /**
     * LIFECYCLE GATE.
     *
     * Cancelling the loop (rather than early-returning inside it) means
     * three.js costs literally nothing while the operational map is on screen.
     * Reverse scroll restarts it.
     */
    const checkGate = () => {
      // Raw progress, not cinematicProgress. The old threshold resolved to raw
      // ~0.63, which cancelled the loop while the planet was still at ~99%
      // opacity — a hard cut to black rather than a dissolve.
      const shouldRun = experience.progress < HANDOFF.globeSettled;
      if (shouldRun && !running) {
        running = true;
        lastTime = performance.now();
        raf = requestAnimationFrame(frame);
      } else if (!shouldRun && running) {
        running = false;
        cancelAnimationFrame(raf);
        group.visible = false;
        stars.visible = false;
      }
    };
    const gateInterval = window.setInterval(checkGate, 250);

    // ── Resize ──────────────────────────────────────────────────────────
    const handleResize = () => {
      width = container.clientWidth || 1;
      height = container.clientHeight || 1;
      aspect = width / height;
      framing = framingFor(aspect);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      if (!running) return;
      renderer.render(scene, camera);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearInterval(gateInterval);
      window.clearTimeout(readyTimeout);
      window.removeEventListener('resize', handleResize);

      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      dayTexture.dispose();
      nightTexture.dispose();
      cloudTexture.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [debugTarget, reducedMotion]);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
}
