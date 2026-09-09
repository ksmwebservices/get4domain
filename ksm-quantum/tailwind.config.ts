import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07070c',
          900: '#0b0b12',
          850: '#101019',
          800: '#16161f',
          700: '#20202c',
        },
        accent: {
          DEFAULT: '#6d6cff',
          400: '#8a89ff',
          cyan: '#22d3ee',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      maxWidth: { container: '1200px' },
    },
  },
  plugins: [],
};

export default config;
