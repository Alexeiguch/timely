// postcss.config.mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {}, // if using Tailwind v4
    // OR for Tailwind v3:
    // tailwindcss: {},
    // autoprefixer: {},
  },
};