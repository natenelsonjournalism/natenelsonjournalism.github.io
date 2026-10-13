// Single source of truth for the Content-Security-Policy.
// Used by src/layouts/BaseLayout.astro (emits the <meta> tag) and by
// scripts/verify-build.mjs (fails the build if any page lacks it).
export const CSP = [
  "default-src 'none'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "manifest-src 'self'",
  "script-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  'upgrade-insecure-requests',
].join('; ');
