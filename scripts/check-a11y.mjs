#!/usr/bin/env node
// Accessibility check for the built site (CI only; nothing here ships to the site).
// Serves dist/ on localhost, opens every page in headless Chrome in both light and dark
// mode, and runs axe-core's WCAG 2.2 A/AA rules. Exits non-zero on any violation.
//
// Dev dependencies: axe-core (the rules) and playwright-core (drives the browser; it
// downloads nothing). Browser: the runner's installed Google Chrome, or the path in
// CHROME_PATH.
//
//   npm run build && npm run a11y

import { createServer } from 'node:http';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, relative, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const axeSource = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

// Minimal static server for dist/, like GitHub Pages: /about/ → /about/index.html.
const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(dist, path));
  if (!file.startsWith(dist)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

const pages = [];
for await (const f of walk(dist)) {
  if (f.endsWith('.html')) pages.push('/' + relative(dist, f).split('\\').join('/').replace(/index\.html$/, ''));
}
pages.sort();

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' },
);

let problems = 0;
try {
  for (const colorScheme of /** @type {const} */ (['light', 'dark'])) {
    // bypassCSP lets the test inject axe; the site itself still runs no scripts.
    const context = await browser.newContext({ colorScheme, bypassCSP: true });
    const page = await context.newPage();
    for (const path of pages) {
      await page.goto(base + path, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      // The homepage hides each command's output until it runs: check every one.
      if (path === '/' && colorScheme === 'light' && !pages.some((p) => p.startsWith('/#'))) {
        const ids = await page.evaluate(() => [...document.querySelectorAll('.cli-out[id]')].map((e) => e.id));
        pages.push(...ids.map((id) => `/#${id}`));
      }
      await page.evaluate(axeSource);
      const results = await page.evaluate(() =>
        // @ts-expect-error: axe is injected above
        window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }),
      );
      for (const v of results.violations) {
        problems++;
        console.error(`✗ ${path} (${colorScheme}): ${v.id} — ${v.help}`);
        for (const node of v.nodes.slice(0, 5)) console.error(`    ${node.target.join(' ')}\n      ${node.failureSummary?.split('\n').join('\n      ')}`);
        console.error(`    More: ${v.helpUrl}`);
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (problems) {
  console.error(`\ncheck-a11y: ${problems} problem(s) found.`);
  process.exit(1);
}
console.log(`check-a11y: OK — ${pages.length} page(s) checked in light and dark mode.`);
