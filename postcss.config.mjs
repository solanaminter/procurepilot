// Tailwind CSS v4 requires its PostCSS plugin to be registered for Next.js
// builds; without this file the compiled CSS chunk ships empty (unstyled site).
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
