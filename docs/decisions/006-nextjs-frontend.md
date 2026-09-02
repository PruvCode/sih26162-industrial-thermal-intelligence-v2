# ADR-006: Next.js 14 App Router for Frontend

## Status
Accepted

## Context
We need a React frontend for the GIS command center. Requirements:
- Server-side rendering for SEO/initial load
- TypeScript support
- Good performance for map-heavy app
- Easy deployment (Vercel, Docker)
- Component ecosystem

## Decision
Use **Next.js 14 with App Router**, **TypeScript**, **Tailwind CSS**, and **TanStack Query**.

## Consequences

### Positive
- **App Router**: Server Components by default, streaming, nested layouts
- **TypeScript**: First-class support, `next dev` runs `tsc --noEmit`
- **Tailwind**: Utility-first, dark mode, small bundle with JIT
- **TanStack Query**: Server state management, caching, background refetch
- **Image Optimization**: Automatic for satellite thumbnails
- **Deployment**: `output: 'standalone'` for Docker, Vercel native
- **Bundle Analysis**: `@next/bundle-analyzer` built-in

### Negative
- **Learning curve**: App Router is new paradigm (Server Components, Suspense)
- **Client Components**: MapLibre requires `'use client'`, careful boundary management
- **Hydration**: MapLibre WebGL context can cause hydration mismatches
- **Vendor lock-in**: Vercel features (ISR, Edge) not portable

### Neutral
- **Alternatives considered**:
  - **Vite + React**: Simpler, but no SSR, manual routing, no ISR
  - **Remix**: Great but smaller ecosystem, Shopify-focused
  - **Astro**: Islands architecture, but less React ecosystem integration
  - **Plain React + MapLibre**: No SSR, SEO issues for event pages

## Architecture

```
apps/web/
├── src/
│   ├── app/                    # App Router
│   │   ├── layout.tsx          # Root layout (providers, fonts)
│   │   ├── page.tsx            # Command Center (main)
│   │   ├── globals.css         # Tailwind + CSS variables
│   │   ├── events/
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Event detail (SSR for SEO)
│   │   ├── analytics/
│   │   │   └── page.tsx        # Analytics dashboard
│   │   └── api/                # API routes (if needed)
│   ├── components/
│   │   ├── map/                # MapLibre components
│   │   ├── panels/             # Side panels
│   │   ├── ui/                 # Primitive components
│   │   ├── charts/             # Recharts components
│   │   └── layout/             # Header, Sidebar, Footer
│   ├── features/               # Feature-specific logic
│   │   ├── events/             # Event hooks (TanStack Query)
│   │   ├── map/                # Map hooks
│   │   ├── analytics/
│   │   └── websocket/
│   ├── hooks/                  # Generic hooks
│   ├── lib/                    # Utilities
│   ├── services/               # Business logic
│   ├── types/                  # TypeScript types
│   ├── styles/                 # Global styles
│   └── mocks/                  # Development mock data
├── public/
├── tests/
├── next.config.js
├── tsconfig.json
├── tailwind.config.ts
└── package.json
```

## Key Patterns

### Server Component with Client Island
```tsx
// app/page.tsx (Server Component)
import { Map } from '@/components/map/Map';
import { EventListPanel } from '@/components/panels/EventListPanel';
import { getEvents } from '@/services/api';

export default async function CommandCenter() {
  // Fetch on server (cached)
  const events = await getEvents({ bbox: INDIA_BBOX, limit: 500 });
  
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex relative">
        {/* Client Component for MapLibre */}
        <Map initialEvents={events} />
        {/* Other panels */}
      </div>
    </div>
  );
}
```

```tsx
// components/map/Map.tsx (Client Component)
'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

export function Map({ initialEvents }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const map = new maplibregl.Map({ container: containerRef.current, ... });
    // Add layers, events
    return () => map.remove();
  }, []);
  
  return <div ref={containerRef} className="w-full h-full" />;
}
```

### TanStack Query for API State
```tsx
// features/events/useEvents.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useEvents(params: EventParams) {
  return useQuery({
    queryKey: ['events', params],
    queryFn: () => api.getEvents(params),
    staleTime: 30_000, // 30s
    refetchInterval: 60_000, // 1min background
  });
}
```

### CSS Variables for Theming
```css
/* styles/variables.css */
:root {
  --bg-primary: #020617;
  --bg-secondary: #0f172a;
  --text-primary: #f1f5f9;
  --accent-blue: #38bdf8;
  --severity-critical: #ef4444;
  /* ... */
}
```

## Related
- ADR-004: MapLibre (used in Next.js)
- ADR-005: FastAPI backend (API consumer)
- Frontend Architecture: `docs/architecture/frontend-architecture.md`