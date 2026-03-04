/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Syne', 'Inter', 'sans-serif'],
      },
      colors: {
        mono: {
          0: '#000000',
          50: '#0a0a0a',
          100: '#111111',
          150: '#1a1a1a',
          200: '#222222',
          300: '#333333',
          400: '#555555',
          500: '#777777',
          600: '#999999',
          700: '#aaaaaa',
          800: '#cccccc',
          900: '#eeeeee',
          950: '#f5f5f5',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-slide-up': 'fadeSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
        'dot-bounce': 'dotBounce 1.4s ease-in-out infinite',
        'pulse-border': 'pulse-border 3s ease-in-out infinite',
        'subtle-glow': 'subtle-glow 4s ease-in-out infinite',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
    },
  },
  plugins: [],
}
