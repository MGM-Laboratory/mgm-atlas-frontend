import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#ffffff',
        surface: '#ffffff',
        'surface-muted': '#f7f7f5',
        'surface-inverse': '#0e1116',
        ink: {
          DEFAULT: '#0e1116',
          2: '#3b4150',
          3: '#6b7280',
          4: '#9aa1ad',
        },
        line: {
          DEFAULT: '#ececea',
          strong: '#d8d8d2',
        },
        brand: {
          blue: '#3a6dc5',
          yellow: '#f7bf33',
          red: '#f94141',
          green: '#0f8657',
          'blue-50': '#ecf1fa',
          'yellow-50': '#fef6e0',
          'red-50': '#fee5e5',
          'green-50': '#e2f1ea',
          'yellow-ink': '#8a6d18',
        },
        focus: '#3a6dc5',
      },
      fontFamily: {
        display: [
          '"Bricolage Grotesque"',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        sans: ['"Geist"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-2xl': [
          'clamp(2.5rem, 6vw + 1rem, 4.5rem)',
          { lineHeight: '1.02', letterSpacing: '-0.03em', fontWeight: '600' },
        ],
        'display-xl': [
          'clamp(2rem, 4.5vw + 1rem, 3.5rem)',
          { lineHeight: '1.05', letterSpacing: '-0.025em', fontWeight: '600' },
        ],
        'display-lg': [
          'clamp(1.75rem, 3vw + 1rem, 2.5rem)',
          { lineHeight: '1.10', letterSpacing: '-0.02em', fontWeight: '600' },
        ],
        h1: ['2rem', { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '600' }],
        h2: ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '600' }],
        h3: ['1.25rem', { lineHeight: '1.30', letterSpacing: '-0.005em', fontWeight: '600' }],
        h4: ['1.0625rem', { lineHeight: '1.40', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.60' }],
        body: ['1rem', { lineHeight: '1.60' }],
        'body-sm': ['0.9375rem', { lineHeight: '1.55' }],
        caption: [
          '0.8125rem',
          { lineHeight: '1.50', letterSpacing: '0.005em', fontWeight: '500' },
        ],
        eyebrow: [
          '0.75rem',
          { lineHeight: '1.40', letterSpacing: '0.12em', fontWeight: '600' },
        ],
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '12px',
        lg: '20px',
        xl: '28px',
      },
      boxShadow: {
        '1': '0 1px 2px rgba(14,17,22,0.04), 0 1px 1px rgba(14,17,22,0.03)',
        '2': '0 6px 24px -8px rgba(14,17,22,0.10), 0 2px 6px -2px rgba(14,17,22,0.05)',
        '3': '0 24px 60px -20px rgba(14,17,22,0.18), 0 4px 12px -4px rgba(14,17,22,0.06)',
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'in-out-soft': 'cubic-bezier(0.65, 0, 0.35, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        '120': '120ms',
        '200': '200ms',
        '320': '320ms',
        '520': '520ms',
        '800': '800ms',
      },
      maxWidth: {
        prose: '640px',
        container: '1200px',
        'container-wide': '1360px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'modal-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 520ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'modal-in': 'modal-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.4s linear infinite',
        spin: 'spin-slow 0.8s linear infinite',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')({ strategy: 'class' }), require('tailwindcss-animate')],
};

export default config;
