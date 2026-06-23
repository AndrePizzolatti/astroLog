import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cosmos: {
          950: '#0b0630',
          900: '#160f5c',
          800: '#261b82',
          700: '#3525a8',
          600: '#4433cc',
          500: '#5b4de8',
          400: '#7c6ff5',
          300: '#a29bff',
        },
        nebula: { 300: '#f9a8d4', 400: '#f472b6', 500: '#ec4899' },
        star:   { 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b' },
        aurora: { 300: '#6ee7b7', 400: '#34d399', 500: '#10b981' },
      },
      fontFamily: {
        syne:  ['var(--font-syne)', 'sans-serif'],
        mono:  ['var(--font-space-mono)', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
