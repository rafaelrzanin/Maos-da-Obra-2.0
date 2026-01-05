/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // NEW: Configure dark mode to 'class'
  content: [
    "./index.html",
    "./index.tsx", // Adicionado para garantir que o Tailwind leia as classes do index.tsx
    "./App.tsx",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F172A', // Slate 900
          light: '#1E293B',   // Slate 800
          dark: '#020617',    // Slate 950
          darker: '#000000',  // NEW: Even darker for sidebar background
        },
        secondary: {
          DEFAULT: '#D97706', // Amber 600
          light: '#F59E0B',   // Amber 500
          dark: '#B45309',    // Amber 700
        },
        // REMOVIDO: status-inprogress
        success: {
          DEFAULT: '#059669', // Emerald 600
          light: '#D1FAE5',
          dark: '#064E3B'
        },
        warning: {
          DEFAULT: '#D97706', // Amber 600
          light: '#FEF3C7',
          dark: '#78350F'
        },
        danger: {
          DEFAULT: '#DC2626', // Red 600
          light: '#FEE2E2',
          dark: '#7F1D1D'
        },
        premium: {
          DEFAULT: '#B45309', // Amber 700 (Bronze/Gold visual)
          light: '#F59E0B',   // Amber 500
          dark: '#78350F'     // Amber 900
        },
        surface: '#F8FAFC', // Slate 50
        text: {
          main: '#0F172A', // Slate 900
          body: '#334155', // Slate 700
          muted: '#64748B', // Slate 500
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-premium': 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        'gradient-gold': 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)',
        'gradient-dark-gold': 'linear-gradient(135deg, #451a03 0%, #78350f 100%)',
        'gradient-vitalicio-bonus': 'linear-gradient(135deg, #0F172A 0%, #173250 100%)', // New gradient for vitalicio bonus tools
        // REMOVIDO: 'gradient-vitalicio-blue'
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'glow': '0 0 20px rgba(245, 158, 11, 0.4)',
        // NEW: Custom shadows for cards
        'card-default': '0 18px 45px -30px rgba(15,23,42,0.45)', // Existing light mode shadow
        'card-dark-subtle': '0 4px 15px rgba(255, 255, 255, 0.08), 0 0 5px rgba(255, 255, 255, 0.05)', // Subtle light shadow for dark mode
        // NEW: Generic shadows for status colors (use with opacity utilities like shadow-red-500/20)
        'red-500/20': '0 4px 6px -1px rgba(239, 68, 68, 0.1), 0 2px 4px -2px rgba(239, 68, 68, 0.1)',
        'green-500/20': '0 4px 6px -1px rgba(34, 197, 94, 0.1), 0 2px 4px -2px rgba(34, 197, 94, 0.1)',
        'amber-500/20': '0 4px 6px -1px rgba(245, 158, 11, 0.1), 0 2px 4px -2px rgba(245, 158, 11, 0.1)',
        'slate-400/20': '0 4px 6px -1px rgba(148, 163, 184, 0.1), 0 2px 4px -2px rgba(148, 163, 184, 0.1)',
      }
    },
  },
  plugins: [],
}