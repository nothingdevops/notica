import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'status-success': 'var(--success)',
        'status-failure': 'var(--failure)',
        'status-warning': 'var(--warning)',
        'status-skipped': 'var(--skipped)',
        'bg-base':     'var(--bg-base)',
        'bg-card':     'var(--bg-card)',
        'bg-elevated': 'var(--bg-elevated)',
        'bg-hover':    'var(--bg-hover)',
        'c-border':    'var(--border)',
        'text-1':      'var(--text-1)',
        'text-2':      'var(--text-2)',
        'text-3':      'var(--text-3)',
        'c-accent':    'var(--accent)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
