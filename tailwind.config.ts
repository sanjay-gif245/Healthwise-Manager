import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Brand / navbar
        brand: {
          DEFAULT: '#0F766E', // logo / active nav / primary button bg
          hover: '#115E59', // primary button hover
        },
        navtext: '#334155', // navigation text
        appbg: '#F8FAFC', // main background
        surface: '#FFFFFF',
        border: {
          DEFAULT: '#E2E8F0', // card border
        },
        ink: {
          DEFAULT: '#0F172A', // doctor name / strong text
          muted: '#64748B', // specialty / secondary text
        },
        available: '#16A34A', // availability indicator / low urgency
        urgency: {
          low: { bg: '#F0FDF4', text: '#166534', dot: '#16A34A' },
          medium: { bg: '#FFFBEB', text: '#92400E', dot: '#D97706' },
          high: { bg: '#FEF2F2', text: '#991B1B', dot: '#DC2626' },
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
