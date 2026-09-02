import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          void: '#05070B',
          deep: '#0A0F17',
          primary: '#0F172A',
          secondary: '#1E293B',
          elevated: '#334155',
        },
        border: {
          subtle: 'rgba(255, 255, 255, 0.06)',
          default: 'rgba(255, 255, 255, 0.10)',
          strong: 'rgba(255, 255, 255, 0.16)',
        },
        text: {
          primary: '#F8FAFC',
          secondary: '#94A3B8',
          muted: '#64748B',
          disabled: '#475569',
        },
        accent: {
          cyan: '#00D9FF',
          green: '#22C55E',
        },
        severity: {
          fire: '#EF4444',
          persistent: '#F97316',
          wildfire: '#FACC15',
          other: '#64748B',
        },
      },
      fontFamily: {
        // Resolve through the next/font variables so the Tailwind utilities and
        // the raw CSS variables can never drift apart.
        display: ['var(--font-display)'],
        sans: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        'display-hero': ['clamp(4rem, 8vw, 8.75rem)', { lineHeight: '0.95', letterSpacing: '-0.025em', fontWeight: '400' }],
        'display-xl': ['clamp(2.625rem, 5vw, 5rem)', { lineHeight: '1.0', letterSpacing: '-0.02em', fontWeight: '400' }],
        'display-lg': ['clamp(1.75rem, 3vw, 2.5rem)', { lineHeight: '1.1', letterSpacing: '-0.01em', fontWeight: '400' }],
        'display-md': ['clamp(1.25rem, 2vw, 1.75rem)', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '400' }],
        'label-xs': ['0.5625rem', { lineHeight: '1.4', letterSpacing: '0.14em' }],
        'label-sm': ['0.625rem', { lineHeight: '1.4', letterSpacing: '0.10em' }],
        'label-md': ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.08em' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        glass: '12px',
        'glass-lg': '16px',
      },
      backdropBlur: {
        glass: '24px',
        'glass-lg': '32px',
      },
      boxShadow: {
        glass: '0 1px 2px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)',
        'glass-elevated': '0 2px 4px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.4), 0 16px 48px rgba(0,0,0,0.2)',
        'glass-nav': '0 1px 0 rgba(255,255,255,0.03)',
        'thermal-glow': '0 0 20px rgba(239,68,68,0.15)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-right': 'slideInRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'bar-fill': 'barFill 0.8s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-ring': 'pulseRing 2.5s cubic-bezier(0.16, 1, 0.3, 1) infinite',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
        'scan-line': 'scanLine 4s ease-in-out infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        barFill: {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseRing: {
          '0%': { transform: 'scale(1)', opacity: '0.5' },
          '50%': { transform: 'scale(1.15)', opacity: '0.15' },
          '100%': { transform: 'scale(1)', opacity: '0.5' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
