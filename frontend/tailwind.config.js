/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#ff5a5f",
        secondary: "#00a699",
        surface: "#f7f7f9",
        card: "#ffffff",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
