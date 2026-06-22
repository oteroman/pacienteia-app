import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './providers/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // ── Azul Médico — primary, trust, navigation, actions
        brand: {
          50:  '#EBF4FC',
          100: '#D4E8F8',
          200: '#A9D1F1',
          300: '#7EBAEB',
          400: '#62A4E6',
          500: '#4A90E2',  // Azul Médico — base
          600: '#2E78D0',
          700: '#1E5EA8',
          800: '#154580',
          900: '#0D2D52',
        },
        // ── Morado IA — solo para features de inteligencia artificial
        ai: {
          50:  '#F5EDF9',
          100: '#EAD8F3',
          200: '#D4AEE6',
          300: '#BE84D9',
          400: '#A861CC',
          500: '#8E44AD',  // Morado IA — base
          600: '#73368B',
          700: '#5A2A6E',
          800: '#401E50',
          900: '#281333',
        },
        // ── Lima Peruano — éxito, recuperación, wellness
        lima: {
          50:  '#E6F7EE',
          100: '#C2EDD4',
          200: '#86DAA9',
          300: '#3DC47D',
          400: '#00B062',
          500: '#00A859',  // Lima Peruano — base
          600: '#008A48',
          700: '#006C38',
          800: '#004E28',
          900: '#003018',
        },
        // ── Neutrales de marca
        ink:   '#0E1A2B',  // Tinta — texto principal
        mist:  '#F8F9FA',  // Bruma — fondo base
        fog:   '#DCE2EA',  // Niebla — bordes
        slate: '#6B7585',  // Pizarra — texto secundario
      },
      boxShadow: {
        xs:  '0 1px 2px rgba(14,26,43,0.06)',
        sm:  '0 2px 6px rgba(14,26,43,0.08)',
        md:  '0 4px 16px rgba(14,26,43,0.10)',
        lg:  '0 8px 32px rgba(14,26,43,0.12)',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
      },
    },
  },
  plugins: [],
}

export default config
