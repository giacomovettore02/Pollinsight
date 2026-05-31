/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f0f8',
          100: '#e9dff2',
          200: '#d4bfe5',
          300: '#b994d6',
          400: '#9b6ac4',
          500: '#6B2D8C',
          600: '#5a2677',
          700: '#4a1f62',
          800: '#3c194e',
          900: '#2d143a',
        },
        secondary: {
          50: '#fffef0',
          100: '#fffbd9',
          200: '#fff6ad',
          300: '#ffef80',
          400: '#ffe54d',
          500: '#FFD700',
          600: '#d9b800',
          700: '#b89700',
          800: '#997a00',
          900: '#7a6100',
        },
        cta: {
          50: '#e6faf5',
          100: '#ccf5eb',
          200: '#99ebd7',
          300: '#66e0c3',
          400: '#33d6af',
          500: '#20C997',
          600: '#1aa87d',
          700: '#148a66',
          800: '#0e6b4f',
          900: '#084d38',
        },
      },
    },
  },
  plugins: [],
};
