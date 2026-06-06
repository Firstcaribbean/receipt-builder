import type { Config } from 'tailwindcss';

const config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0f172a',
          800: '#16233d'
        }
      },
      boxShadow: {
        receipt: '0 24px 70px rgba(15, 23, 42, 0.16)'
      }
    }
  },
  plugins: []
} satisfies Config;

export default config;
