#!/usr/bin/env node
// Post-build guard for the security baseline described in CLAUDE.md.
// Plain Node, no dependencies. Exits non-zero if any file in dist/ breaks a rule:
//
//   HTML pages
//     - must carry the exact CSP <meta> tag inside <head>
//     - must not contain <script> or <style> elements (sole exception: a
//       <script type="application/ld+json"> block holding valid JSON, which
//       browsers never execute)
//     - must not use style="" or on*="" (event handler) attributes
//     - must not load resources (src, srcset, poster, data, <link href>,
//       CSS url()) from any host other than our own
//   CSS files
//     - must not reference url() / @import on another host
//   Sitemap
//     - must list every page (except 404) and nothing else
//   SVG files
//     - must not contain scripts, event handlers, or external references
//
// Outbound <a href> links (e.g. to published articles) are allowed.

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CSP } from '../src/config/csp.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const SITE_HOST = 'natenelsonjournalism.github.io';

const errors = [];
const fail = (file, msg) => errors.push(`${relative(root, file)}: ${msg}`);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':', sol: '/', period: '.', tab: '\t', newline: '\n' };

function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (match, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

// Returns a reason string if the URL would load from somewhere other than this site.
function externalReason(rawUrl) {
  const url = decodeEntities(rawUrl).replace(/[\u0000- ]/g, '');
  if (url === '' || url.startsWith('#')) return null;
  const lower = url.toLowerCase();
  if (lower.startsWith('data:')) return 'data: URL (blocked by CSP)';
  if (lower.startsWith('javascript:')) return 'javascript: URL';
  if (lower.startsWith('//') || lower.startsWith('\\\\') || /^[a-z][a-z0-9+.-]*:/.test(lower)) {
    let host;
    try {
      host = new URL(url, `https://${SITE_HOST}/`).host;
    } catch {
      return 'unparseable URL';
    }
    return host === SITE_HOST ? null : `external host "${host}"`;
  }
  return null; // relative path on our own origin
}

function checkCssUrls(file, css, context) {
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of cleaned.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi)) {
    const url = m[1] ?? m[2] ?? m[3] ?? '';
    const reason = externalReason(url);
    if (reason) fail(file, `${context} url(${url}) → ${reason}`);
  }
  for (const m of cleaned.matchAll(/@import\s+(?:"([^"]*)"|'([^']*)')/gi)) {
    const url = m[1] ?? m[2];
    const reason = externalReason(url);
    if (reason) fail(file, `${context} @import "${url}" → ${reason}`);
  }
}

// Matches a start tag, honouring quoted attribute values that may contain ">".
const TAG_RE = /<([a-zA-Z][^\s\/>]*)((?:\s+[^\s"'=<>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?|\s*\/)*)\s*>/g;
const ATTR_RE = /([^\s"'=<>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function parseAttrs(attrText) {
  const attrs = [];
  for (const m of attrText.matchAll(ATTR_RE)) {
    attrs.push({ name: m[1].toLowerCase(), value: m[2] ?? m[3] ?? m[4] ?? '' });
  }
  return attrs;
}

// Checks shared by HTML and SVG documents.
function checkMarkup(file, markup, { isHtml }) {
  const body = markup.replace(/<!--[\s\S]*?-->/g, '');
  let cspInHead = false;
  let inHead = false;

  for (const m of body.matchAll(TAG_RE)) {
    const tag = m[1].toLowerCase();
    const attrs = parseAttrs(m[2] ?? '');
    const get = (name) => attrs.find((a) => a.name === name)?.value;

    if (tag === 'head') inHead = true;
    if (tag === 'body') inHead = false;

    if (tag === 'script') {
      // The one exception: a JSON-LD data block (structured data for search engines).
      // Browsers never execute it, but we still require it to be pure, valid JSON.
      if (isHtml && (get('type') ?? '').trim().toLowerCase() === 'application/ld+json' && attrs.length === 1) {
        const start = m.index + m[0].length;
        const end = body.toLowerCase().indexOf('</script', start);
        const json = end === -1 ? '' : body.slice(start, end);
        if (json.includes('<')) fail(file, 'JSON-LD block must not contain "<" (escape it as \\u003c)');
        try {
          JSON.parse(json);
        } catch {
          fail(file, 'JSON-LD block is not valid JSON');
        }
      } else {
        fail(file, '<script> element is not allowed (only <script type="application/ld+json"> data blocks)');
      }
    }
    if (tag === 'style') fail(file, '<style> element is not allowed (use an external stylesheet)');
    if (tag === 'iframe' || tag === 'frame' || tag === 'object' || tag === 'embed') {
      fail(file, `<${tag}> element is not allowed (no embeds)`);
    }

    for (const { name, value } of attrs) {
      if (name === 'style') fail(file, `style="" attribute on <${tag}> is not allowed`);
      if (/^on[a-z]+$/.test(name)) fail(file, `${name}="" event handler on <${tag}> is not allowed`);

      if (['src', 'poster', 'data', 'background'].includes(name) || (name === 'href' && tag === 'link')) {
        const reason = externalReason(value);
        if (reason) fail(file, `<${tag} ${name}="${value}"> → ${reason}`);
      }
      if (name === 'srcset' || name === 'imagesrcset') {
        for (const candidate of decodeEntities(value).split(',')) {
          const url = candidate.trim().split(/\s+/)[0];
          const reason = url && externalReason(url);
          if (reason) fail(file, `<${tag} ${name}> candidate "${url}" → ${reason}`);
        }
      }
      if (!isHtml && (name === 'href' || name === 'xlink:href')) {
        const reason = externalReason(value);
        if (reason) fail(file, `SVG <${tag} ${name}="${value}"> → ${reason}`);
      }
    }

    if (isHtml && tag === 'meta' && (get('http-equiv') ?? '').toLowerCase() === 'content-security-policy') {
      if (decodeEntities(get('content') ?? '') !== CSP) {
        fail(file, `CSP <meta> content does not match src/config/csp.mjs`);
      } else if (!inHead) {
        fail(file, 'CSP <meta> must be inside <head>');
      } else {
        cspInHead = true;
      }
    }
    if (isHtml && tag === 'meta' && (get('http-equiv') ?? '').toLowerCase() === 'refresh') {
      fail(file, '<meta http-equiv="refresh"> is not allowed');
    }
  }

  if (isHtml && !cspInHead) fail(file, 'missing CSP <meta http-equiv="Content-Security-Policy"> in <head>');
}

// Every page except 404 must be listed in the sitemap, and nothing else.
async function checkSitemap(files) {
  const sitemaps = files.filter((f) => /sitemap-\d+\.xml$/.test(f));
  if (sitemaps.length === 0) return fail(dist, 'no sitemap-*.xml found');
  const listed = new Set();
  for (const f of sitemaps) {
    for (const m of (await readFile(f, 'utf8')).matchAll(/<loc>([^<]+)<\/loc>/g)) listed.add(m[1]);
  }
  const expected = new Set(
    files
      .filter((f) => f.endsWith('.html') && !f.endsWith('404.html'))
      .map((f) => `https://${SITE_HOST}/${relative(dist, f).split('\\').join('/').replace(/index\.html$/, '')}`),
  );
  for (const url of expected) if (!listed.has(url)) fail(dist, `sitemap is missing ${url}`);
  for (const url of listed) if (!expected.has(url)) fail(dist, `sitemap lists ${url}, which is not a page`);
}

async function main() {
  let files;
  try {
    files = [];
    for await (const f of walk(dist)) files.push(f);
  } catch {
    console.error(`verify-build: ${relative(root, dist)}/ not found. Run "astro build" first.`);
    process.exit(1);
  }

  let pages = 0;
  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (ext === '.html') {
      pages++;
      checkMarkup(file, await readFile(file, 'utf8'), { isHtml: true });
    } else if (ext === '.svg') {
      checkMarkup(file, await readFile(file, 'utf8'), { isHtml: false });
    } else if (ext === '.css') {
      checkCssUrls(file, await readFile(file, 'utf8'), 'stylesheet');
    } else if (ext === '.js' || ext === '.mjs') {
      fail(file, 'JavaScript file in build output; the site must ship zero JS');
    }
  }

  if (pages === 0) fail(dist, 'no HTML pages found');
  await checkSitemap(files);

  if (errors.length) {
    console.error(`verify-build: ${errors.length} problem(s) found:\n`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    console.error('\nSee CLAUDE.md for the rules these checks enforce.');
    process.exit(1);
  }
  console.log(`verify-build: OK — ${pages} page(s), ${files.length} file(s) checked.`);
}

await main();
