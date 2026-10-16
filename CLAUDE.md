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
  official Pages actions. No stored secrets.
- **Ask before adding any npm package** beyond Astro and its official integrations.
  Prefer a few lines of our own code over a new dependency.

## Security rules (enforced by `scripts/verify-build.mjs`)

The shipped site has **zero JavaScript** and makes **no third-party requests**. This is a
deliberate design choice so the CSP can be `script-src 'none'`.

- Every page uses `src/layouts/BaseLayout.astro`, which emits the CSP `<meta>` tag.
  The policy string lives only in `src/config/csp.mjs`; the layout and the verifier
  both import it.
- No `<script>`, no `<style>` elements, no `style=""` attributes, no `on*=` handlers,
  no `<iframe>`/`<object>`/`<embed>`, no `.js` files in `dist/`.
  - Astro hoists component `<style>` blocks into external CSS because
    `build.inlineStylesheets: 'never'` is set. Don't use `is:inline` styles/scripts, and
    don't use `define:vars` (it emits inline styles).
  - Don't add client islands (`client:*` directives), view transitions, or prefetch.
- `src`, `srcset`, `poster`, `<link href>`, CSS `url()` and `@import` must be same-origin.
  Fonts, images and the PGP key are self-hosted under `public/` or `src/assets/`.
  Outbound `<a href>` links to articles are fine.
- No analytics, embeds, CDN links, or social widgets.
- Interactivity is replaced by static generation: e.g. Work-page filters are separate
  pages (`/work/topic/ransomware/`), and dark mode follows `prefers-color-scheme` (no toggle).

If the verifier flags something, fix the source; don't loosen the verifier without
asking Nate.

## CI / supply chain

- `.github/workflows/deploy.yml`: top-level `permissions: {}`; build job gets
  `contents: read`, deploy job gets `pages: write` + `id-token: write`.
  Checkout uses `persist-credentials: false`; no dependency cache.
- **Every action is pinned to a full commit SHA** with the version in a trailing comment.
  Resolve SHAs with `git ls-remote --tags https://github.com/<owner>/<action>.git`.
- Dependabot (`.github/dependabot.yml`) updates npm and github-actions weekly.
- `actions/upload-pages-artifact` skips dotfiles by default. When Phase 5 adds
  `public/.well-known/security.txt`, set `include-hidden-files: true` on that step.

## Content

All site content lives in three places. Astro checks every entry when the site builds;
if something is wrong (a missing field, a misspelled topic, a bad date, a duplicate id),
the build stops and names the file, the entry and the problem. Nothing broken goes live.

- `src/data/clips.yaml`: published articles.
- `src/content/investigations/*.md`: one case study per file.
- `src/data/appearances.yaml`: talks, podcasts, TV, radio, panels.
- `src/config/topics.ts`: the fixed list of topics. Add a topic there before using it.
- `src/config/site.ts`: name, homepage pitch, bios, CV/PGP file paths and contact channels.
  A value left as `null` shows on the site as a clearly marked yellow "Placeholder" box,
  so nothing fake is ever presented as real.
- Schemas: `src/content.config.ts`. Helpers for pages (sorting, archive links):
  `src/lib/content.ts`.

### How to add a new clip

Add an entry to `src/data/clips.yaml` (anywhere in the list; the site sorts by date):

```yaml
- id: wired-2026-hospital-ransomware   # unique; lowercase letters, numbers, hyphens
  title: "Ransomware gang claims attack on regional hospital network"
  outlet: Wired
  date: 2026-09-18                     # YYYY-MM-DD
  url: https://example.com/the-article # full https:// link
  topics: [ransomware, cybercrime]     # from src/config/topics.ts
  summary: "One or two sentences on what the story found."
  featured: true                       # optional: show on the homepage (default false)
  # archive_url: https://web.archive.org/web/...   # optional: archived copy
  # link_status: dead                  # optional: set when the original link breaks
```

- Wrap any text containing a colon followed by a space (`: `) in double quotes. Quoting
  titles and summaries always is the safe habit.
- When a link dies, set `link_status: dead`. If `archive_url` is set the site links to
  the archive and labels it "(archived)"; otherwise the title shows without a link.
- Once published, don't change an `id`: investigations refer to clips by it.

### How to add an investigation

Create `src/content/investigations/<short-name>.md`. The file name (without `.md`)
becomes the page address, e.g. `/investigations/hospital-ransomware/`.

```markdown
---
title: "Tracing a ransomware attack on a hospital network"
date: 2026-09-30
outlets: [Wired]
related_clips: [wired-2026-hospital-ransomware]   # clip ids from clips.yaml
impact:
  - "Hospital disclosed the full scope of the breach"
  - "State regulator opened an inquiry"
summary: "One or two sentences for the index page."
---

The case study, in Markdown: how the story started, how it was reported, what changed.
```

Every id in `related_clips` must exist in `clips.yaml`, or the build fails.

### How to add an appearance

Add an entry to `src/data/appearances.yaml`: `id` (unique, as for clips), `title`,
`event_or_show`, `date`, `type` (`talk`, `podcast`, `tv`, `radio` or `panel`) and an
optional `url`.

## Design

Clean, editorial, typography-led. Credible rather than "hacker aesthetic": no
green-on-black terminals or matrix effects. Homepage stays short. Light/dark via
`prefers-color-scheme`, both WCAG AA. Responsive to 320px. Visible focus styles.
No motion.

- Styles: `src/styles/global.css` (colour tokens at the top; both themes checked for
  WCAG AA contrast, so re-check if you change a colour). Fonts: Source Serif 4 (reading)
  and Inter (labels, navigation), self-hosted OFL files in `public/fonts/` with their
  licenses; `@font-face` rules in `src/styles/fonts.css`.
- Pages: `src/pages/`. Shared pieces: `src/components/` (`ClipItem`, `ClipsByYear`,
  `WorkFilters`, `FilteredWork`, `Placeholder`).
- Work filter pages are generated only for topics, outlets and years that have clips.
  Outlet pages use a slug of the outlet name, so spell each outlet identically every time.

## Never commit

Drafts, source notes, unpublished documents, secrets, real phone numbers, or images/PDFs
that haven't been scrubbed of metadata (EXIF/GPS, PDF author/revision history).
Public repo history is permanent.
