# CLAUDE.md

Portfolio site for Nate Nelson, cybersecurity journalist. Live at
https://natenelsonjournalism.github.io. `PLAN.md` is the build brief: work through
its phases in order and stop for review at the end of each one.

## Workflow

- Work on a branch, open a pull request, and stop. Nate squash-merges on github.com.
  Never push to `main`.
- `npm run build` runs `astro build` and then `scripts/verify-build.mjs`. Both must pass
  before pushing. CI runs the same command on every PR; pushes to `main` also deploy.
- `npm run check` type-checks with `astro check` (dev-only: `@astrojs/check` + TypeScript 6,
  approved by Nate; never shipped to the site). CI runs it before the build.
- `npm run a11y` (after a build) checks every page for WCAG 2.2 A/AA problems in light and
  dark mode with axe-core, driven by `playwright-core` (dev-only; downloads no browser).
  CI uses the runner's Chrome; locally set `CHROME_PATH` to a Chrome/Chromium binary.
- Node version is pinned in `.nvmrc`. Install with `npm ci --ignore-scripts` (same as CI).
- **PR previews:** Cloudflare Pages (project `natenelson-preview`) builds every PR branch
  and posts a `*.natenelson-preview.pages.dev` link on the PR. Previews only; the real site
  is GitHub Pages. Cloudflare's automatic production deploys are switched off, and its build
  sets `NPM_CONFIG_IGNORE_SCRIPTS=true` to match CI. Preview links are public: never push
  anything that isn't ready to be public anyway.

## Stack

- Astro (pinned exact version), `output: 'static'`, TypeScript strict
  (`astro/tsconfigs/strict`).
- Hosted on GitHub Pages, deployed by `.github/workflows/deploy.yml` with GitHub's
  official Pages actions. The deploy uses no stored secrets (the only secret in the repo
  is the GitLab backup token; see below).
- **Ask before adding any npm package** beyond Astro and its official integrations.
  Prefer a few lines of our own code over a new dependency.

## Security rules (enforced by `scripts/verify-build.mjs`)

The shipped site has **zero JavaScript** and makes **no third-party requests**. This is a
deliberate design choice so the CSP can be `script-src 'none'`.

- Every page uses `src/layouts/BaseLayout.astro`, which emits the CSP `<meta>` tag.
  The policy string lives only in `src/config/csp.mjs`; the layout and the verifier
  both import it.
- No `<script>` (sole exception: `<script type="application/ld+json">` holding valid JSON,
  emitted only by `src/components/PersonJsonLd.astro`; browsers never execute it), no `<style>` elements, no `style=""` attributes, no `on*=` handlers,
  no `<iframe>`/`<object>`/`<embed>`, no `.js` files in `dist/`.
  - Astro hoists component `<style>` blocks into external CSS because
    `build.inlineStylesheets: 'never'` is set. Don't use `is:inline` styles/scripts, and
    don't use `define:vars` (it emits inline styles).
  - Don't add client islands (`client:*` directives), view transitions, or prefetch.
- `src`, `srcset`, `poster`, `<link href>`, CSS `url()` and `@import` must be same-origin.
  Fonts and images are self-hosted under `public/` or `src/assets/`.
  Outbound `<a href>` links to articles are fine.
- Every link to another site must carry `rel="noopener noreferrer"`. Components add it by
  hand; Markdown links in investigations get it from `src/lib/external-links-plugin.mjs`, so
  write links there in Markdown syntax (`[text](https://...)`), not raw `<a>` HTML.
- No analytics, embeds, CDN links, or social widgets.
- **Podcast audio is the one approved exception** (Nate, Oct 2026): episodes play in the
  browser's own `<audio controls preload="none">` player, straight from the show's hosting
  company, and nothing loads until the visitor presses play. No Spotify/Apple embeds
  (they load third-party scripts and trackers for every visitor). Allowed audio hosts are
  listed in `AUDIO_HOSTS` in `src/config/csp.mjs`, which adds them to the CSP's `media-src`;
  the content schema rejects audio from any other host, and the verifier fails on `<audio>`
  without `controls` and `preload="none"`, or from an unlisted host. `<video>` stays banned.
- Interactivity is replaced by static generation, and dark mode follows
  `prefers-color-scheme` (no toggle).

- No phone numbers anywhere: the verifier fails on `tel:` links, phone-number Signal links
  and phone-number-shaped text.
- Images and PDFs in `public/`, `src/` and `dist/` must carry no hidden metadata (EXIF/GPS,
  XMP, IPTC, PNG text chunks, PDF author or revision history); the verifier fails otherwise.
- `public/.well-known/security.txt` (RFC 9116) needs `Contact`, `Expires` and `Canonical`.
  **Renew `Expires` every year** (no more than a year ahead). From 60 days before it, the
  build shows a warning and the monthly site check opens an issue. Expiry never blocks a
  deploy (Nate's call: an expired file is harmless, a blocked deploy is not). Add an `Encryption:` line once the PGP key is published
  (it must point to a key file on this site).

If the verifier flags something, fix the source; don't loosen the verifier without
asking Nate.

## CI / supply chain

- `.github/workflows/deploy.yml`: top-level `permissions: {}`; build job gets
  `contents: read`, deploy job gets `pages: write` + `id-token: write`.
  Checkout uses `persist-credentials: false`; no dependency cache.
- **Every action is pinned to a full commit SHA** with the version in a trailing comment.
  Resolve SHAs with `git ls-remote --tags https://github.com/<owner>/<action>.git`.
- Dependabot (`.github/dependabot.yml`) updates npm and github-actions weekly.
- `actions/upload-pages-artifact` skips dotfiles by default, so the deploy sets
  `include-hidden-files: true` to ship `.well-known/security.txt`.
- `.github/workflows/accessibility.yml`: axe check on every PR and push to `main`
  (read-only; separate from the deploy, so it never holds one up).
- `.github/workflows/links.yml`: on the 1st of each month (or "Run workflow" on the Actions tab), checks
  every outbound link on the built site and security.txt's expiry. Problems go into one
  GitHub issue, updated each month and closed automatically once everything passes. Sites
  that block automated checks (403/429) are listed separately, not counted as broken.
  Placeholder `example.com` links are skipped. Permissions: `contents: read`, `issues: write`.
  Never blocks a deploy.

- `.github/workflows/backup.yml`: copies every branch and tag to a private GitLab project
  after each change to `main`, every Sunday, and on "Run workflow". No third-party actions.
  It pushes over HTTPS with a GitLab **fine-grained personal access token** limited to that
  one project, with only the "Code: Push" and "Code: Download" permissions: secret
  `GITLAB_BACKUP_TOKEN` and variable `GITLAB_BACKUP_REPO`
  (`https://gitlab.com/<user>/<project>.git`; the workflow refuses any other host). The
  token expires within a year: GitLab emails a warning, and once it lapses the backup fails
  and GitHub emails that too. Renew it by making a new token and replacing the secret.
  Nothing is deleted on GitLab, and GitLab's protected `main` refuses force pushes, so a
  rewritten history here makes the backup fail instead of overwriting it. If the token ever
  leaks, revoke it on GitLab. GitHub issues and PR discussions are not included (they
  aren't part of git).

### Security headers and Mozilla Observatory

GitHub Pages doesn't let a site set its own HTTP headers, so some protections can only come
from `<meta>` tags and some aren't possible at all:

- Set by the site in `<meta>`: Content-Security-Policy (`script-src 'none'`), referrer policy.
- Not possible on GitHub Pages: `frame-ancestors` / `X-Frame-Options` (clickjacking; only
  work as headers), `X-Content-Type-Options`, `Permissions-Policy`, cross-origin isolation
  headers. Observatory findings about these are hosting limitations, not site bugs. With no
  scripts and no forms, framing the site gives an attacker little to work with.
- HTTPS and HSTS come from GitHub (`github.io` is on the browser HSTS preload list).

Observatory results (https://developer.mozilla.org/en-US/observatory), scanned by Nate on
2026-10-16 after the Phase 5 merge: **B, 75/100**. The score is consistent with the two
header-only deductions above: no `X-Frame-Options`/`frame-ancestors` (−20) and no
`X-Content-Type-Options` (−5). Neither can be fixed on GitHub Pages. Reaching A would mean
moving to a host that allows custom headers (e.g. Cloudflare Pages with a `_headers` file).
Re-scan after any hosting change.

## Metadata and discoverability

- `BaseLayout.astro` emits per-page title, description, canonical URL (always the
  github.io address, so preview copies never compete in search), Open Graph and X card tags,
  icons, manifest, RSS and sitemap links. Props: `title`, `description`, `noindex`,
  `ogType`, `person` (adds schema.org `Person` JSON-LD; used on Home and About).
- One static share image for every page: `public/og-default.png` (1200×630). Icons:
  `public/favicon.svg` (monogram drawn from Source Serif 4), `favicon-32.png`,
  `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`; manifest `public/site.webmanifest`.
  These were rendered once with a headless browser and contain no metadata; redo them
  after the design pass.
- `@astrojs/sitemap` (official integration, approved by the plan) writes
  `sitemap-index.xml` + `sitemap-0.xml`; `public/robots.txt` points to it. The verifier fails
  if any page (except 404) is missing from the sitemap.
- RSS feed of new work (investigations, features, podcast episodes): `src/pages/rss.xml.ts`
  (hand-written, no dependency), at `/rss.xml`.
- Professional profiles for JSON-LD `sameAs`: `PROFILES` and `ARCHIVES` in `src/config/site.ts`.

## Content

The site has three sections for Nate's three kinds of work (decided Oct 2026):
**Journalism** (a few investigations, each with a short write-up page, plus a few features
and links to the full archive at each outlet), **Podcasts** (shows he has written and/or
hosted, with playable episodes) and **Projects** (side projects). Speaking and media
appearances are a section of the About page.

Astro checks every entry when the site builds; if something is wrong (a missing field, a
bad date, a duplicate id, a disallowed audio host, a write-up whose Markdown fails to
render), the build stops and names the file, the entry and the problem. Nothing broken
goes live.

- `src/content/investigations/*.md`: one investigation per file, with its write-up.
- `src/data/features.yaml`: feature articles.
- `src/data/podcasts.yaml`: shows and their standout episodes.
- `src/data/projects.yaml`: side projects.
- `src/data/appearances.yaml`: talks, panels, podcast guest spots, TV, radio (About page).
- `src/config/site.ts`: name, homepage pitch, bios, full-archive links (`ARCHIVES`),
  profiles, headshot and contact channel (Signal username only; Nate dropped the CV, PGP key,
  SecureDrop and the public email address in Oct 2026). A value left as `null` (or an empty
  list) shows on the site as a clearly marked yellow "Placeholder" box, so nothing fake is
  ever presented as real.
- Schemas: `src/content.config.ts`. Helpers for pages (sorting, archive links):
  `src/lib/content.ts`.
- Order: investigations, features and appearances sort by date (newest first). Podcasts
  and projects appear in the order they're written in their file. The homepage shows up to
  three stories and three projects marked `featured: true` (or the first three if none are).
- Wrap any text containing a colon followed by a space (`: `) in double quotes. Quoting
  titles and summaries always is the safe habit.
- When a story's link dies, set `link_status: dead`. If `archive_url` is set the site links
  to the archive and labels it; otherwise it says the original is no longer online.

### How to add an investigation

Create `src/content/investigations/<short-name>.md`. The file name (without `.md`)
becomes the page address, e.g. `/journalism/hospital-ransomware/`.

```markdown
---
title: "Tracing a ransomware attack on a hospital network"
outlet: Wired
date: 2026-09-30
url: https://example.com/the-article          # the published story
summary: "One or two sentences for the Journalism page."
impact:
  - "Hospital disclosed the full scope of the breach"
  - "State regulator opened an inquiry"
featured: true                                 # optional: show on the homepage
# archive_url: https://web.archive.org/web/... # optional
# link_status: dead                            # optional: when the original link breaks
---

A short write-up, in Markdown: how the story started, how it was reported, what changed.
Write links as [text](https://...).
```

### How to add a feature

Add an entry to `src/data/features.yaml`:

```yaml
- id: wired-2026-router-flaw          # unique; lowercase letters, numbers, hyphens
  title: "Unpatched router flaw exploited by state-backed hackers"
  outlet: Wired
  date: 2026-07-02                    # YYYY-MM-DD
  url: https://example.com/the-article
  summary: "One sentence on the story."
  featured: true                      # optional
```

### How to add a podcast

Add a show to `src/data/podcasts.yaml`:

```yaml
- id: the-show                        # unique
  name: "The Show"
  role: Writer and host
  years: 2024–present                 # optional
  description: "One or two sentences about the show."
  cover: /images/podcasts/the-show.jpg  # optional; square image in public/, metadata stripped
  links:                              # all optional
    spotify: https://open.spotify.com/show/...
    apple: https://podcasts.apple.com/...
    website: https://...
  episodes:
    - title: "Episode title"
      date: 2026-08-14                 # optional; undated episodes are left out of the RSS feed
      summary: "One sentence."         # optional
      audio: https://.../episode.mp3   # optional: the episode's audio file, from the show's RSS feed
      url: https://...                 # optional: the episode's web page
      transcript: https://...          # optional, but helps accessibility (WCAG 1.2.1)
```

- `audio` is the `enclosure url` of the episode in the show's RSS feed. Its host, and every
  host it redirects through (stats services, CDNs), must be in `AUDIO_HOSTS` in
  `src/config/csp.mjs`, or the browser refuses to play it. The build names a missing first
  host; the monthly site check follows redirects and names any missing later hop. After
  adding a show, press play on the Cloudflare preview to confirm. Without `audio`, the
  episode title links to its page instead.

### How to add a project

Add an entry to `src/data/projects.yaml`: `id`, `name`, `summary`, and optionally `url`,
`year` (e.g. `2024` or `2024–present`), `featured`, and `image` (a path in `public/`) with
`image_alt` (a short description, or `""` if purely decorative).

### How to add an appearance

Add an entry to `src/data/appearances.yaml`: `id` (unique), `title`, `event_or_show`,
`date`, `type` (`talk`, `podcast`, `tv`, `radio` or `panel`) and an optional `url`.

## Design

Clean, editorial, typography-led. Credible rather than "hacker aesthetic": no
green-on-black terminals or matrix effects. Homepage stays short. Light/dark via
`prefers-color-scheme`, both WCAG AA. Responsive to 320px. Visible focus styles.
No motion.

- Styles: `src/styles/global.css` (colour tokens at the top; both themes checked for
  WCAG AA contrast, so re-check if you change a colour). Fonts: Source Serif 4 (reading)
  and Inter (labels, navigation), self-hosted OFL files in `public/fonts/` with their
  licenses; `@font-face` rules in `src/styles/fonts.css`.
- Pages: `src/pages/` (Home, `journalism/` with one page per investigation, `podcasts`,
  `projects`, `about`, `contact`, `404`). Shared pieces: `src/components/` (`StoryItem`,
  `Episode`, `Placeholder`, `PersonJsonLd`).

## Never commit

Drafts, source notes, unpublished documents, secrets, real phone numbers, or images/PDFs
that haven't been scrubbed of metadata (EXIF/GPS, PDF author/revision history).
Public repo history is permanent.
