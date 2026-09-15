/**
 * NOTE: this file is CommonJS (`.cjs` under a `"type": "module"` package), so it
 * must use `module.exports` - an `export default` here is a syntax error and
 * silently disables Tailwind entirely (finding F1).
 *
 * `ink` / `brand-300..500` are backed by the CSS custom properties declared in
 * src/styles/global.css so that light and dark palettes stay coherent and
 * meet WCAG AA (finding F8).
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}', './public/**/*.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          50: 'rgb(var(--af-ink-50) / <alpha-value>)',
          100: 'rgb(var(--af-ink-100) / <alpha-value>)',
          200: 'rgb(var(--af-ink-200) / <alpha-value>)',
          300: 'rgb(var(--af-ink-300) / <alpha-value>)',
          400: 'rgb(var(--af-ink-400) / <alpha-value>)',
          500: 'rgb(var(--af-ink-500) / <alpha-value>)',
          600: 'rgb(var(--af-ink-600) / <alpha-value>)',
          700: 'rgb(var(--af-ink-700) / <alpha-value>)',
          800: 'rgb(var(--af-ink-800) / <alpha-value>)',
          900: 'rgb(var(--af-ink-900) / <alpha-value>)',
          950: 'rgb(var(--af-ink-950) / <alpha-value>)'
        },
        brand: {
          50: '#eefcff',
          100: '#d9f6ff',
          200: '#b4ecff',
          300: 'rgb(var(--af-brand-300) / <alpha-value>)',
          400: 'rgb(var(--af-brand-400) / <alpha-value>)',
          500: 'rgb(var(--af-brand-500) / <alpha-value>)',
          600: '#008ba5',
          700: '#00708a',
          800: '#005a70',
          900: '#00495c'
        },
        'on-brand': 'rgb(var(--af-on-brand) / <alpha-value>)',
        accent: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9'
        }
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      }
    }
  },
  plugins: []
};
