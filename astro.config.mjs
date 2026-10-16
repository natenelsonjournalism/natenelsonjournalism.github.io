// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// See CLAUDE.md: the shipped site has zero JavaScript and no inline
// scripts or styles, so the CSP can use script-src 'none' and style-src 'self'.
export default defineConfig({
  site: 'https://natenelsonjournalism.github.io',
  output: 'static',
  trailingSlash: 'always',
  // Generates sitemap-index.xml + sitemap-0.xml at build time (no client code).
  integrations: [sitemap()],
  build: {
    // Always emit CSS as external files; never inline <style> blocks.
    inlineStylesheets: 'never',
    format: 'directory',
  },
  // Prefetch injects a client script; keep it off.
  prefetch: false,
  devToolbar: { enabled: false },
});
