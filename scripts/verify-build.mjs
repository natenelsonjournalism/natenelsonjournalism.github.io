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
//       CSS url()) from any host other than our own. Sole exception: podcast
//       <audio> from a host in AUDIO_HOSTS (src/config/csp.mjs), which must have
//       controls and preload="none" so nothing loads until the visitor presses play
//   CSS files
//     - must not reference url() / @import on another host
//   Sitemap
//     - must list every page (except 404) and nothing else
//   SVG files
//     - must not contain scripts, event handlers, or external references
//   Outbound links
//     - <a href> to other sites (e.g. published articles) is allowed, but must carry
//       rel="noopener noreferrer"
//     - no tel: links or phone numbers in page text (Signal is a username, not a number)
//   security.txt (RFC 9116)
//     - must exist with Contact, Expires and Canonical; Expires at most a year out
//     - warns when Expires is within 60 days or has passed (never blocks a deploy:
//       an expired file is harmless, and the monthly site check opens an issue)
//   Images and PDFs (in dist/, public/ and src/)
//     - must carry no hidden metadata: EXIF/GPS, XMP, IPTC, PNG text chunks, PDF author

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CSP, isAllowedAudioUrl } from '../src/config/csp.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const SITE_HOST = 'natenelsonjournalism.github.io';

const errors = [];
const warnings = [];
const fail = (file, msg) => errors.push(`${relative(root, file)}: ${msg}`);
const warn = (file, msg) => warnings.push({ file: relative(root, file), msg });

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
        const allowedAudio = isHtml && tag === 'audio' && name === 'src' && isAllowedAudioUrl(decodeEntities(value).trim());
        if (reason && !allowedAudio) fail(file, `<${tag} ${name}="${value}"> → ${reason}`);
      }
      if (name === 'srcset' || name === 'imagesrcset') {
        for (const candidate of decodeEntities(value).split(',')) {
          const url = candidate.trim().split(/\s+/)[0];
          const reason = url && externalReason(url);
          if (reason) fail(file, `<${tag} ${name}> candidate "${url}" → ${reason}`);
        }
      }
      if (isHtml && tag === 'a' && name === 'href') {
        const href = decodeEntities(value).trim();
        if (/^tel:/i.test(href)) fail(file, `<a href="${value}">: tel: links are not allowed (no phone numbers on the site)`);
        if (/^https?:\/\/signal\.me\/#p\//i.test(href)) fail(file, `<a href="${value}">: this Signal link contains a phone number; use a username link`);
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(href) || href.startsWith('//')) {
          const rel = (get('rel') ?? '').toLowerCase().split(/\s+/);
          if (externalReason(href) && !(rel.includes('noopener') && rel.includes('noreferrer'))) {
            fail(file, `<a href="${value}"> links to another site without rel="noopener noreferrer"`);
          }
        }
      }
      if (!isHtml && (name === 'href' || name === 'xlink:href')) {
        const reason = externalReason(value);
        if (reason) fail(file, `SVG <${tag} ${name}="${value}"> → ${reason}`);
      }
    }

    if (isHtml && tag === 'audio') {
      if ((get('preload') ?? '').toLowerCase() !== 'none') fail(file, '<audio> must have preload="none" (load nothing until the visitor presses play)');
      if (get('controls') === undefined) fail(file, '<audio> must have controls');
    }
    if (isHtml && (tag === 'video' || (tag === 'source' && externalReason(get('src') ?? '')))) {
      fail(file, `<${tag}> is not allowed (podcast audio uses <audio src> directly)`);
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
  if (isHtml) checkPhoneNumbers(file, body);
}

// Phone-number shapes: +44 20 7946 0958, (555) 555-0100, 555-555-0100, 555.555.0100.
// Dates (2026-09-18) and grouped PGP fingerprints don't match these.
const PHONE_RE = /\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}\b|\(\d{3}\)\s?\d{3}[\s.-]\d{4}\b|\b\d{3}[.-]\d{3}[.-]\d{4}\b/;

function checkPhoneNumbers(file, html) {
  const text = decodeEntities(
    html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]*>/g, ' '),
  ).replace(/\s+/g, ' ');
  const m = text.match(PHONE_RE);
  if (m) fail(file, `page text contains what looks like a phone number ("${m[0]}"); never publish phone numbers`);
}

// RFC 9116 security.txt. Expires is set by hand and renewed yearly (see CLAUDE.md).
async function checkSecurityTxt(files) {
  const file = join(dist, '.well-known', 'security.txt');
  if (!files.includes(file)) return fail(file, 'missing (source: public/.well-known/security.txt)');
  const fields = new Map();
  for (const line of (await readFile(file, 'utf8')).split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z-]+):\s*(.+?)\s*$/);
    if (m && !line.startsWith('#')) {
      const key = m[1].toLowerCase();
      fields.set(key, [...(fields.get(key) ?? []), m[2]]);
    }
  }
  for (const required of ['contact', 'expires', 'canonical']) {
    if (!fields.has(required)) fail(file, `missing required "${required}:" field`);
  }
  for (const contact of fields.get('contact') ?? []) {
    if (!/^(mailto:|https:\/\/|tel:)/i.test(contact)) fail(file, `Contact "${contact}" must be a mailto: or https:// URI`);
  }
  const canonical = `https://${SITE_HOST}/.well-known/security.txt`;
  if (fields.has('canonical') && !fields.get('canonical').includes(canonical)) fail(file, `Canonical must be ${canonical}`);
  for (const url of fields.get('encryption') ?? []) {
    // The PGP key is self-hosted: it must be a file in this build.
    const path = url.startsWith(`https://${SITE_HOST}/`) ? url.slice(`https://${SITE_HOST}`.length) : null;
    if (!path || !files.includes(join(dist, ...path.split('/')))) fail(file, `Encryption "${url}" must point to a key file on this site`);
  }

  const expires = fields.get('expires')?.[0];
  if (!expires) return;
  const when = new Date(expires);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(expires) || Number.isNaN(when.getTime())) {
    return fail(file, `Expires "${expires}" is not a date like 2027-10-01T00:00:00Z`);
  }
  const days = (when.getTime() - Date.now()) / 86_400_000;
  const howToRenew = 'set a new date no more than a year ahead in public/.well-known/security.txt';
  if (days <= 0) warn(file, `Expires (${expires}) has passed: ${howToRenew}`);
  else if (days > 366) fail(file, `Expires (${expires}) is more than a year away; RFC 9116 asks for less`);
  else if (days < 60) warn(file, `Expires (${expires}) is in ${Math.ceil(days)} day(s): ${howToRenew}`);
}

// Hidden metadata in images and PDFs (camera, GPS, software, author, edit history).
// Scans the build plus the source folders, because originals stay in git history.
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.tif', '.tiff', '.heic', '.pdf']);

function findMetadata(buf, ext) {
  const found = [];
  if (ext === '.jpg' || ext === '.jpeg') {
    // Walk the JPEG segments before the image data.
    let i = 2;
    while (i + 4 <= buf.length && buf[i] === 0xff) {
      const marker = buf[i + 1];
      if (marker === 0xda || marker === 0xd9) break; // start of scan / end of image
      const len = buf.readUInt16BE(i + 2);
      const head = buf.subarray(i + 4, i + 4 + 32).toString('latin1');
      if (marker === 0xe1 && head.startsWith('Exif')) found.push('EXIF');
      if (marker === 0xe1 && head.startsWith('http://ns.adobe.com/xap')) found.push('XMP');
      if (marker === 0xed) found.push('IPTC/Photoshop');
      if (marker === 0xfe) found.push('JPEG comment');
      i += 2 + len;
    }
  } else if (ext === '.png') {
    let i = 8;
    while (i + 8 <= buf.length) {
      const len = buf.readUInt32BE(i);
      const type = buf.subarray(i + 4, i + 8).toString('latin1');
      if (['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'].includes(type)) found.push(`PNG ${type} chunk`);
      if (type === 'IEND') break;
      i += 12 + len;
    }
  } else if (ext === '.webp') {
    const s = buf.toString('latin1');
    if (s.includes('EXIF')) found.push('EXIF');
    if (s.includes('XMP ')) found.push('XMP');
  } else if (ext === '.pdf') {
    const s = buf.toString('latin1');
    if (/\/Author\s*(\((?!\s*\))|<(?!\s*>))/.test(s)) found.push('PDF author');
    if (s.includes('<x:xmpmeta')) found.push('XMP (PDF edit history)');
    // Each incremental save appends a new %%EOF and keeps the old content.
    // A "fast web view" (linearized) PDF legitimately has two.
    const allowedEofs = /\/Linearized/.test(s.slice(0, 1024)) ? 2 : 1;
    if ((s.match(/%%EOF/g) ?? []).length > allowedEofs) found.push('PDF revision history (incremental saves)');
  } else {
    // GIF/AVIF/TIFF/HEIC: no light-weight parser here, so look for the usual markers.
    const s = buf.toString('latin1');
    if (s.includes('Exif\0\0') || ext === '.tif' || ext === '.tiff' || ext === '.heic') found.push('EXIF (or a format that usually carries it)');
    if (s.includes('<x:xmpmeta')) found.push('XMP');
  }
  return [...new Set(found)];
}

async function checkMetadata(distFiles) {
  const sourceFiles = [];
  for (const dir of ['public', 'src']) {
    try {
      for await (const f of walk(join(root, dir))) sourceFiles.push(f);
    } catch {
      // folder doesn't exist
    }
  }
  for (const file of [...distFiles, ...sourceFiles]) {
    const ext = extname(file).toLowerCase();
    if (!IMAGE_EXTS.has(ext) || file.includes(`${sep}node_modules${sep}`)) continue;
    const found = findMetadata(await readFile(file), ext);
    if (found.length) fail(file, `contains hidden metadata (${found.join(', ')}); strip it before committing (see CLAUDE.md)`);
  }
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
  await checkSecurityTxt(files);
  await checkMetadata(files);

  for (const { file, msg } of warnings) {
    // On GitHub Actions this shows as a yellow annotation on the run and the PR.
    console.warn(process.env.GITHUB_ACTIONS ? `::warning file=${file}::${msg}` : `  ⚠ ${file}: ${msg}`);
  }
  if (errors.length) {
    console.error(`verify-build: ${errors.length} problem(s) found:\n`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    console.error('\nSee CLAUDE.md for the rules these checks enforce.');
    process.exit(1);
  }
  console.log(`verify-build: OK — ${pages} page(s), ${files.length} file(s) checked.`);
}

await main();
