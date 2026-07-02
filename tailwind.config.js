/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        md: {
          surface: 'var(--md-surface)',
          'surface-variant': 'var(--md-surface-variant)',
          'surface-container': 'var(--md-surface-container)',
          'surface-container-high': 'var(--md-surface-container-high)',
          primary: 'var(--md-primary)',
          'on-primary': 'var(--md-on-primary)',
          'primary-container': 'var(--md-primary-container)',
          'on-primary-container': 'var(--md-on-primary-container)',
          secondary: 'var(--md-secondary)',
          'secondary-container': 'var(--md-secondary-container)',
          'on-secondary-container': 'var(--md-on-secondary-container)',
          tertiary: 'var(--md-tertiary)',
          'tertiary-container': 'var(--md-tertiary-container)',
          error: 'var(--md-error)',
          'error-container': 'var(--md-error-container)',
          'on-error': 'var(--md-on-error)',
          outline: 'var(--md-outline)',
          'outline-variant': 'var(--md-outline-variant)',
          'on-surface': 'var(--md-on-surface)',
          'on-surface-variant': 'var(--md-on-surface-variant)',
          'inverse-surface': 'var(--md-inverse-surface)',
          'inverse-on-surface': 'var(--md-inverse-on-surface)',
        },
      },
      fontFamily: {
        sans: ['"Google Sans"', '"Noto Sans SC"', 'Roboto', 'system-ui', 'sans-serif'],
        display: ['"Google Sans"', '"Noto Sans SC"', 'Roboto', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'md': '12px',
        'md-lg': '16px',
        'md-xl': '20px',
        'md-2xl': '24px',
        'md-full': '9999px',
      },
      boxShadow: {
        'md-1': '0 1px 2px 0 rgba(0,0,0,0.3), 0 1px 3px 1px rgba(0,0,0,0.15)',
        'md-2': '0 1px 2px 0 rgba(0,0,0,0.3), 0 2px 6px 2px rgba(0,0,0,0.15)',
        'md-3': '0 4px 8px 3px rgba(0,0,0,0.15), 0 1px 3px 0 rgba(0,0,0,0.3)',
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-in': 'bounceIn 0.5s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.25s ease-out',
        'level-up': 'levelUp 0.8s ease-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        levelUp: {
          '0%': { transform: 'scale(1)', filter: 'brightness(1)' },
          '50%': { transform: 'scale(1.15)', filter: 'brightness(1.3)' },
          '100%': { transform: 'scale(1)', filter: 'brightness(1)' },
        },
      },
    },
  },
  plugins: [],
};