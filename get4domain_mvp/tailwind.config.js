/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/layouts/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        secondary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        success: {
          DEFAULT: '#10b981',
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        warning: {
          DEFAULT: '#f59e0b',
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        error: {
          DEFAULT: '#ef4444',
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        // Vendor-dashboard skin (Bolt reference). brand≈primary blue, gold≈warning,
        // ruby≈error — the same brand identity, named for the dashboard's dark skin.
        // `ink` is the new cool dark-surface scale (no marketing equivalent).
        brand: {
          50: '#eef4ff', 100: '#d9e6ff', 200: '#bcd3ff', 300: '#8eb6ff', 400: '#598dff',
          500: '#3366ff', 600: '#1f47f5', 700: '#1736e1', 800: '#1a2fb6', 900: '#1c2e8f', 950: '#141d57',
        },
        gold: {
          50: '#fffaeb', 100: '#fff1c6', 200: '#ffe188', 300: '#ffcb4a', 400: '#ffb420',
          500: '#f99008', 600: '#dd6f03', 700: '#b74c07', 800: '#94390c', 900: '#7a300d', 950: '#461702',
        },
        ruby: {
          50: '#fef2f2', 100: '#fde3e3', 200: '#fccccd', 300: '#f9a8aa', 400: '#f47478',
          500: '#e6484d', 600: '#d1252a', 700: '#b0181d', 800: '#911819', 900: '#781a1a', 950: '#410a0b',
        },
        ink: {
          50: '#f4f6fb', 100: '#e8ecf5', 200: '#cdd5e6', 300: '#a3b0cc', 400: '#6f7d9e', 500: '#4d5a7a',
          600: '#36415c', 700: '#262f44', 800: '#1a2133', 850: '#141a28', 900: '#0e131e', 950: '#080b13',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      container: {
        center: true,
        padding: '1rem',
        screens: {
          '2xl': '1280px',
        },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 10px 30px -5px rgb(0 0 0 / 0.1), 0 4px 6px -2px rgb(0 0 0 / 0.05)',
        premium: '0 20px 60px -10px rgb(0 0 0 / 0.15), 0 8px 20px -4px rgb(0 0 0 / 0.05)',
        // Ported from the Bolt hero reference (their emerald → our primary blue; their amber == our warning gold).
        device: '0 30px 60px -15px rgba(0,0,0,0.6), 0 18px 36px -18px rgba(37,99,235,0.25)',
        'device-phone': '0 20px 45px -12px rgba(0,0,0,0.55), 0 12px 24px -12px rgba(245,158,11,0.2)',
        glow: '0 0 0 1px rgba(37,99,235,0.25), 0 8px 30px -6px rgba(37,99,235,0.35)',
        'glow-amber': '0 0 0 1px rgba(245,158,11,0.25), 0 8px 30px -6px rgba(245,158,11,0.3)',
        // Vendor-dashboard skin.
        'glow-brand': '0 0 24px -6px rgba(51, 102, 255, 0.45)',
        'glow-gold': '0 0 24px -6px rgba(249, 144, 8, 0.45)',
        'v-card': '0 1px 2px rgba(0,0,0,0.3), 0 4px 16px -4px rgba(0,0,0,0.4)',
        'v-card-hover': '0 4px 8px rgba(0,0,0,0.35), 0 12px 32px -6px rgba(0,0,0,0.5)',
      },
      backgroundImage: {
        'grid-faint': 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        'radial-glow': 'radial-gradient(ellipse 60% 60% at 50% 0%, rgba(51,102,255,0.12), transparent 70%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        float: 'float 3s ease-in-out infinite',
        // Ported from the Bolt hero reference.
        'fade-up': 'fadeUp 0.5s ease-out forwards',
        'float-slow': 'floatSlow 8s ease-in-out infinite',
        'pulse-ring': 'pulseRing 2s ease-out infinite',
        // Vendor-dashboard skin.
        shimmer: 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        // Ported from the Bolt hero reference.
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.95)', opacity: '0.7' },
          '70%': { transform: 'scale(1.1)', opacity: '0' },
          '100%': { transform: 'scale(0.95)', opacity: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
};
