#!/usr/bin/env node
// Weekly site check (run by .github/workflows/links.yml; never blocks a deploy).
// 1. Visits every outbound link on the built site (clips, appearances, write-ups) and
//    reports the ones that are gone (404/410, server errors, dead domains).
// 2. Reports when security.txt is within 60 days of expiring.
//
//   npm run build && node scripts/check-links.mjs [--report report.md]
//
// Writes a Markdown report (used as the GitHub issue body) and, on GitHub Actions,
// sets the step output `problems` to the number of things that need fixing.
// Plain Node, no dependencies.

import { readdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const SITE_HOST = 'natenelsonjournalism.github.io';
const reportArg = process.argv.indexOf('--report');
const reportPath = reportArg > -1 ? process.argv[reportArg + 1] : null;

const TIMEOUT_MS = 20_000;
const CONCURRENCY = 4;
// Some news sites refuse requests that don't look like a browser.
const HEADERS = {
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 (link check for natenelsonjournalism.github.io)',
  accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
};

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

const decode = (s) =>
  s.replace(/&(amp|lt|gt|quot|#39|#x27);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'" })[e]);

// url → { texts: Set, pages: Set }
const links = new Map();
for await (const file of walk(dist)) {
  if (!file.endsWith('.html')) continue;
  const page = '/' + relative(dist, file).split('\\').join('/').replace(/index\.html$/, '');
  const html = await readFile(file, 'utf8');
  for (const m of html.matchAll(/<a\s[^>]*?href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = decode(m[1]);
    if (!/^https?:\/\//i.test(url)) continue;
    const { hostname } = new URL(url);
    // Skip our own site and the reserved example domains used by placeholder content.
    if (hostname === SITE_HOST || /(^|\.)example\.(com|net|org)$|\.(example|invalid|test)$/.test(hostname)) continue;
    const entry = links.get(url) ?? { texts: new Set(), pages: new Set() };
    entry.texts.add(decode(m[2].replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim());
    entry.pages.add(page);
    links.set(url, entry);
  }
}

async function request(url, method) {
  const res = await fetch(url, { method, headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
  await res.body?.cancel();
  return res.status;
}

// Returns { verdict: 'ok' | 'broken' | 'unverified', detail }.
async function check(url) {
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 5_000));
    try {
      let status = await request(url, 'HEAD');
      // Many servers answer HEAD wrongly; confirm anything unexpected with a real GET.
      if (status >= 400) status = await request(url, 'GET');
      if (status < 400) return { verdict: 'ok', detail: String(status) };
      // Bot blocking and rate limits: the page may be fine for people.
      if ([401, 403, 429, 999].includes(status)) return { verdict: 'unverified', detail: `HTTP ${status} (the site blocked the automated check)` };
      if (status >= 500) {
        lastError = `HTTP ${status} (server error)`;
        continue;
      }
      return { verdict: 'broken', detail: status === 404 || status === 410 ? `HTTP ${status} (page not found)` : `HTTP ${status}` };
    } catch (err) {
      const cause = /** @type {any} */ (err)?.cause;
      const code = cause?.code ?? /** @type {any} */ (err)?.name ?? 'error';
      if (code === 'TimeoutError') {
        lastError = 'timed out';
        continue;
      }
      if (code === 'ENOTFOUND') return { verdict: 'broken', detail: 'domain no longer exists (DNS lookup failed)' };
      lastError = `${code}${cause?.message ? `: ${cause.message}` : ''}`;
    }
  }
  return lastError === 'timed out'
    ? { verdict: 'unverified', detail: 'timed out twice' }
    : { verdict: 'broken', detail: lastError };
}

const urls = [...links.keys()].sort();
const results = new Map();
let next = 0;
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, urls.length) }, async () => {
    while (next < urls.length) {
      const url = urls[next++];
      results.set(url, await check(url));
    }
  }),
);

// security.txt expiry
let securityNote = null;
try {
  const txt = await readFile(join(dist, '.well-known', 'security.txt'), 'utf8');
  const expires = txt.match(/^Expires:\s*(\S+)/m)?.[1];
  const days = expires ? Math.ceil((new Date(expires).getTime() - Date.now()) / 86_400_000) : NaN;
  if (!expires || Number.isNaN(days)) securityNote = 'security.txt has no valid `Expires:` date.';
  else if (days <= 0) securityNote = `security.txt expired on ${expires.slice(0, 10)}. Deploys will fail until it is renewed.`;
  else if (days < 60) securityNote = `security.txt expires in ${days} day(s), on ${expires.slice(0, 10)}.`;
} catch {
  securityNote = 'security.txt is missing from the build.';
}

const broken = urls.filter((u) => results.get(u).verdict === 'broken');
const unverified = urls.filter((u) => results.get(u).verdict === 'unverified');
const problems = broken.length + (securityNote ? 1 : 0);

const cell = (s) => s.replace(/\|/g, '\\|');
const row = (u) => {
  const { texts, pages } = links.get(u);
  const shown = [...pages].slice(0, 3).join(', ') + (pages.size > 3 ? ` and ${pages.size - 3} more` : '');
  return `| ${cell([...texts].join(' / ') || '(no text)')} | ${cell(u)} | ${results.get(u).detail} | ${shown} |`;
};
const table = (list) => ['| Link text | Address | Result | Found on |', '| --- | --- | --- | --- |', ...list.map(row)].join('\n');

const lines = [`Checked ${urls.length} outbound link(s) on ${new Date().toISOString().slice(0, 10)}.`, ''];
if (broken.length) {
  lines.push(
    `## ${broken.length} broken link(s)`,
    '',
    table(broken),
    '',
    '**How to fix a broken clip:** find it in `src/data/clips.yaml`, add `link_status: dead`, and if',
    'the Wayback Machine (https://web.archive.org) has a copy, add it as `archive_url:`.',
    'The site will then link to the archived copy, or show the title without a link.',
    'Appearances live in `src/data/appearances.yaml`; remove or update their `url`.',
    '',
  );
}
if (securityNote) {
  lines.push(
    '## security.txt',
    '',
    securityNote,
    'Set a new `Expires:` date, no more than a year ahead, in `public/.well-known/security.txt`.',
    '',
  );
}
if (unverified.length) {
  lines.push(
    `## ${unverified.length} link(s) that couldn't be checked automatically`,
    '',
    'These sites blocked or timed out on the automated check. That usually means bot protection,',
    'not a dead page, so they are not counted as problems. Worth opening by hand now and then.',
    '',
    table(unverified),
    '',
  );
}
if (!problems && !unverified.length) lines.push('Everything is working.', '');
lines.push('_This report is made by the weekly site check (`.github/workflows/links.yml`)._');
const report = lines.join('\n');

if (reportPath) await writeFile(reportPath, report);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `problems=${problems}\n`);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report + '\n');
console.log(report);
console.log(`\ncheck-links: ${broken.length} broken, ${unverified.length} unverified, ${urls.length - broken.length - unverified.length} OK.`);
