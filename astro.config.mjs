// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { externalLinks } from './src/lib/external-links-plugin.mjs';

// See CLAUDE.md: the shipped site has zero JavaScript and no inline
// scripts or styles, so the CSP can use script-src 'none' and style-src 'self'.
export default defineConfig({
  site: 'https://natenelsonjournalism.github.io',
  output: 'static',
  trailingSlash: 'always',
  // Generates sitemap-index.xml + sitemap-0.xml at build time (no client code).
  integrations: [sitemap()],
  // Off-site links in Markdown get rel="noopener noreferrer" (see CLAUDE.md).
  markdown: { processor: satteri({ hastPlugins: [externalLinks] }) },
  build: {
    // Always emit CSS as external files; never inline <style> blocks.
    inlineStylesheets: 'never',
    format: 'directory',
  },
  // Prefetch injects a client script; keep it off.
  prefetch: false,
  devToolbar: { enabled: false },
});
