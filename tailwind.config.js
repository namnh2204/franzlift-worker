/** @type {import('tailwindcss').Config} */
export default {
  content: ['./views/**/*.ejs', './public/**/*.js'],
  theme: {
    extend: {
      colors: {
        franz: {
          DEFAULT: '#419AC2',
          dark: '#2f7ea3',
          light: '#DAECF8',
          soft: '#f4f8fb',
        },
        ink: '#14212b',
        muted: '#687783',
        line: '#e4edf2',
      },
      fontFamily: {
        sans: ['Inter', 'Arial', '"Helvetica Neue"', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      maxWidth: {
        wrap: '1320px',
      },
      keyframes: {
        kenburns: {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.12)' },
        },
      },
      animation: {
        kenburns: 'kenburns 8s ease-out forwards',
      },
    },
  },
  plugins: [],
}
