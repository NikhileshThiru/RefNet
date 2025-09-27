/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        'cedar-primary': '#ffd700',
        'cedar-secondary': '#ffed4e',
        'cedar-dark': '#1a1a2e',
        'cedar-light': '#b8c5d1',
      },
    },
  },
  plugins: [],
}
