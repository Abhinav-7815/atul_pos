/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        atul: {
          pink_primary: "#D63384",
          pink_deep: "#C2185B",
          pink_soft: "#FFE4EF",
          cream: "#FFF5F8",
          charcoal: "#1A1A2E",
          gray: "#6B7280",
          mango: "#FFA726",
          mint: "#4CAF50",
          red: "#EF5350",
        }
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'serif'],
        sans: ['Montserrat', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
