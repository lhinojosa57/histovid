/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        parchment: {
          50: '#fdf8f0',
          100: '#f9edd8',
          200: '#f2d9b0',
          300: '#e8c07e',
          400: '#dca04e',
          500: '#d08030',
        },
        ink: {
          900: '#1a1208',
          800: '#2d1f0e',
          700: '#3d2c14',
          600: '#5c4424',
          500: '#7a5c34',
        },
        sepia: {
          100: '#f4e9d4',
          200: '#e8d3a9',
          300: '#d4b87e',
        },
        crimson: {
          500: '#9b1c1c',
          600: '#7f1d1d',
          400: '#dc2626',
        },
        gold: {
          400: '#d4af37',
          500: '#b8960c',
          300: '#e8cc5a',
        }
      },
      backgroundImage: {
        'paper': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        'manuscript': '0 2px 8px rgba(26,18,8,0.15), 0 1px 3px rgba(26,18,8,0.1)',
        'raised': '0 8px 32px rgba(26,18,8,0.2), 0 2px 8px rgba(26,18,8,0.12)',
        'inset-paper': 'inset 0 2px 6px rgba(26,18,8,0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(16px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        pulseGold: { '0%,100%': { boxShadow: '0 0 0 0 rgba(212,175,55,0.4)' }, '50%': { boxShadow: '0 0 0 8px rgba(212,175,55,0)' } },
      }
    },
  },
  plugins: [],
}
