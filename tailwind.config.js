/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './App.tsx', './components/**/*.tsx'],
  theme: {
    extend: {
      // Height breakpoints so everything fits on one phone screen without scrolling
      screens: {
        short: { raw: '(max-height: 800px)' },
        shorter: { raw: '(max-height: 600px)' },
      },
    },
  },
  plugins: [],
};
