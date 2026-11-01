/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          900: '#0F2C23',
          DEFAULT: '#153D30',
          800: '#1A4A3B',
          light: '#235343'
        },
        ivory: '#FAF6EF',
        cream: '#F2E9DC',
        sage: {
          light: '#EBF4E9',
          DEFAULT: '#DCE9D8',
          dark: '#3E6B48'
        },
        terracotta: {
          light: '#FCECE6',
          DEFAULT: '#B85F3D'
        },
        lavender: {
          light: '#EEEDFA',
          DEFAULT: '#DCDCF5'
        },
        mutedOrange: {
          light: '#FDF4E9',
          DEFAULT: '#F4D2A7'
        },
        charcoal: '#20231F',
        mutedGrey: '#77776F',
        borderCream: '#E6DCCF'
      },
      fontFamily: {
        serif: ['Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

