# CLAUDE.md

Maintainer notes for Nate Nelson's portfolio site (cybersecurity journalist). Live at
https://natenelsonjournalism.github.io.

## Workflow

- Work on a branch, open a pull request, and stop. Nate squash-merges on github.com.
  Never push to `main`.
- Commit messages and PR descriptions are short and plain: what changed and why, in a
  few lines. No AI attribution anywhere (no `Co-authored-by`/session trailers, no
  "Generated with" footers), Nate's call (Oct 2026).
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

The site makes **no third-party requests** and ships **one small script of our own**,
`public/cli.js`, on the homepage only. Every other page keeps `script-src 'none'`.

- Every page uses `src/layouts/BaseLayout.astro`, which emits the CSP `<meta>` tag.
  The policies live only in `src/config/csp.mjs` (`CSP` for every page, `CSP_CLI` for the
  homepage); the layout and the verifier both import them.
- **The command box is the one approved script** (Nate, Oct 2026). `public/cli.js` lets
  visitors type the homepage's commands. It compares the typed text against a fixed list
  and, on a match, changes `location.hash` to show a section that is already in the page;
  it never displays, stores or sends what was typed. The homepage's CSP is
  `script-src 'self'` plus Trusted Types (`require-trusted-types-for 'script'`), so the
  browser refuses inline scripts and any text-to-HTML conversion. The verifier allows
  exactly `<script src="/cli.js" defer>` on the homepage, no other `.js` file, and fails if
  `cli.js` uses `innerHTML`-style APIs, `eval`, network requests, storage or cookies, or
  navigates anywhere but `#`. Everything must still work without it: every command is
  also a link. Keep it plain hand-written JS in `public/` (no bundling, no dependencies).
- No other `<script>` (one more exception: `<script type="application/ld+json">` holding valid JSON,
  emitted only by `src/components/PersonJsonLd.astro`; browsers never execute it), no `<style>` elements, no `style=""` attributes, no `on*=` handlers,
  no `<iframe>`/`<object>`/`<embed>`.
  - Astro hoists component `<style>` blocks into external CSS because
    `build.inlineStylesheets: 'never'` is set. Don't use `is:inline` styles, or `is:inline`
    scripts other than the `cli.js` tag in `BaseLayout.astro`, and don't use `define:vars`
    (it emits inline styles).
  - Don't add client islands (`client:*` directives), view transitions, or prefetch.
- `src`, `srcset`, `poster`, `<link href>`, CSS `url()` and `@import` must be same-origin.
  Fonts and images are self-hosted under `public/` or `src/assets/`.
  Outbound `<a href>` links to articles are fine.
- Every link to another site must carry `rel="noopener noreferrer"`. Components add it by
  hand; any Markdown links get it from `src/lib/external-links-plugin.mjs`, so write
  links in Markdown syntax (`[text](https://...)`), not raw `<a>` HTML.
- No analytics, embeds, CDN links, or social widgets.
- **Podcast audio is the one approved exception** (Nate, Oct 2026): episodes play in the
  browser's own `<audio controls preload="none">` player, straight from the show's hosting
  company, and nothing loads until the visitor presses play. No Spotify/Apple embeds
  (they load third-party scripts and trackers for every visitor). Allowed audio hosts are
  listed in `AUDIO_HOSTS` in `src/config/csp.mjs`, which adds them to the CSP's `media-src`;
  the content schema rejects audio from any other host, and the verifier fails on `<audio>`
  without `controls` and `preload="none"`, or from an unlisted host. `<video>` stays banned.
- Showing and hiding the homepage's sections is done with CSS `:target`, not script, and
  dark mode follows `prefers-color-scheme` (no toggle).

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

- Set by the site in `<meta>`: Content-Security-Policy (`script-src 'none'`; on the homepage
  `script-src 'self'` with Trusted Types), referrer policy.
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
  `ogType`, `person` (adds schema.org `Person` JSON-LD; used on the homepage), `cli` (the
  homepage's script and CSP) and `cwd` (the "where you are" path in the header prompt).
- One static share image for every page: `public/og-default.png` (1200×630, the terminal
  `whoami` screen). Icons: a bold green "N" drawn as a path from JetBrains Mono, on the dark
  background (Nate, Oct 2026; it replaced an "N_" monogram that looked too much like another
  site's): `public/favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` (square corners;
  iOS rounds them), `icon-192.png`, `icon-512.png`; manifest `public/site.webmanifest`. All
  rendered with a headless browser and free of metadata; redo them if the design changes,
  and then bump the `?v=` number on the icon links in `BaseLayout.astro` (browsers cache
  icons hard). The ASCII portrait in `whoami` is drawn from the headshot by
  `scripts/portrait.py` (Python 3 + Pillow, run by hand; not part of the build); rerun it
  if the headshot changes.
- `README.md` is one line, "My personal website." (Nate's call, Oct 2026); the details
  live here.
- `@astrojs/sitemap` (official integration, approved by the plan) writes
  `sitemap-index.xml` + `sitemap-0.xml`; `public/robots.txt` points to it. The verifier fails
  if any page (except 404) is missing from the sitemap.
- RSS feed of new work (investigations, features, podcast episodes): `src/pages/rss.xml.ts`
  (hand-written, no dependency), at `/rss.xml`.
- Professional profiles for JSON-LD `sameAs`: `PROFILES` and `ARCHIVES` in `src/config/site.ts`.

## Content

The whole site is one page laid out like a terminal (Nate, Oct 2026): his name, a list of
commands to type, and each command's output below. Commands (Nate, Oct 2026), in this order: `whoami`
(about him, with speaking and media appearances, if any), `news` (a few investigations, then
features, then the full-archive link; each story is a title linking to the article, with
a one-line summary), `pod` (shows he has written, with playable episodes), `proj`, `tips` (contact; it replaced `ping` in Oct 2026, which no longer works) and
`help` (shows the list again; not itself listed, Nate's call). Each command's output is a section of
`src/pages/index.astro`, with its own id: `/#stories`, `/#podcasts`, `/#projects`,
`/#about`, `/#contact` (kept as they were, so links shared elsewhere still work).

Astro checks every entry when the site builds; if something is wrong (a missing field, a
bad date, a duplicate id, a disallowed audio host), the build stops and names the file, the entry and the problem. Nothing broken
goes live.

- `src/content/investigations/*.md`: one investigation per file (front matter only).
- `src/data/features.yaml`: feature articles.
- `src/data/podcasts.yaml`: shows and their standout episodes.
- `src/data/projects.yaml`: side projects.
- `src/data/appearances.yaml`: talks, panels, podcast guest spots, TV, radio (`whoami`).
- `src/config/site.ts`: name, homepage tagline, `about` text (`ABOUT`), full-archive links (`ARCHIVES`),
  profiles, headshot (shown in `whoami` as ASCII art, from `src/data/portrait-light.txt` and
  `portrait-dark.txt`, one per colour scheme; the photo only goes to search engines) and contact channels (a Signal username link, and LinkedIn from `PROFILES`; Nate dropped the CV, PGP key,
  SecureDrop and the public email address in Oct 2026). A value left as `null` (or an empty
  list) shows on the site as a clearly marked yellow "Placeholder" box, so nothing fake is
  ever presented as real.
- Schemas: `src/content.config.ts`. Helpers for pages (sorting, archive links):
  `src/lib/content.ts`.
- Order: investigations, features and appearances sort by date (newest first). Podcasts
  and projects appear in the order they're written in their file. `featured` is kept in the
  schemas but currently changes nothing: every command shows all its entries.
- Wrap any text containing a colon followed by a space (`: `) in double quotes. Quoting
  titles and summaries always is the safe habit.
- When a story's link dies, set `link_status: dead`. If `archive_url` is set the site links
  to the archive and labels it; otherwise it says the original is no longer online.

### How to add an investigation

Create `src/content/investigations/<short-name>.md`. Investigations show like features (a
title linking to the article, plus the summary), listed first under `news`. There are no
separate write-up pages (Nate, Oct 2026; the old write-ups are in the git history).

```markdown
---
title: "Tracing a ransomware attack on a hospital network"
outlet: Wired
date: 2026-09-30
url: https://example.com/the-article          # the published story
summary: "One line: what the story found and what changed."
featured: true                                 # optional; currently unused
# archive_url: https://web.archive.org/web/... # optional
# link_status: dead                            # optional: when the original link breaks
---
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

A terminal you can read (Nate, Oct 2026). The homepage is the whole site: the name in ASCII art (figlet's `larry3d` font, with a
screen-reader-only `<h1>`) and the tagline, `help` (the commands, each with a
plain-English description), then the
output of whichever command ran, and a prompt to type the next one. No tab bar, little
up front. Commands are typed, not clicked (Nate, Oct 2026): with the script they show as
plain text, and they become links only when scripts are off, so the page still works
then. Commands are short and the same on every device. Capitals don't matter
(`WHOAMI` and `Whoami` work), and a near-miss like `whaomi` gets "Did you mean...". Past commands
show a short `$` prompt; the full `nate@nelson:~$` appears only on the live line. One font (JetBrains Mono) at one size, as in a real terminal:
headings stand out by weight and colour. Colours have one job each (Nate, Oct 2026):
green for the prompt and commands, yellow for error messages, blue (`--link`) for every
link, muted grey for dates, descriptions and `# comment` subheadings. Outputs have no visible
title (Nate, Oct 2026): the `$ command` line says what they are, and each keeps a
screen-reader-only `<h2>`. Like a terminal window, pages fill the browser's
width (left-aligned, no centred column), and text grows a little on big screens (16px up
to 18px); on the homepage lines stop at 100 characters so they stay readable. The homepage is compact (Nate: most outputs should fit
on one screen; `news` and `pod` may run longer), every output sits the same distance
above the prompt, the ASCII name is set a little smaller than the text (on two lines
below 40rem, so phones can read it), and a typed command scrolls the page only as far as needed to show
its output and the prompt, as a terminal would. The word "command" in the help line is green, like the
commands themselves. Credible, not a costume: no matrix effects.
Light/dark via `prefers-color-scheme`, both WCAG AA. Responsive to 320px. Visible focus
styles. Motion: the command box's cursor blinks for as long as the box has focus (Nate's
call: it is a text cursor, like the browser's own); other decorative cursors stop after
five blinks (WCAG 2.2.2), and a command's output "prints" in over
a third of a second. None of it runs for visitors who ask for reduced motion.

- Adding a command: add a `CliOutput` section to `index.astro`, an entry to its
  `COMMANDS` list (the command, its section's id and a description), and the same
  command to `COMMANDS` (and `MAIN`, for Tab completion) in `public/cli.js`. `npm run a11y` checks every section automatically.
- Prompt text is decoration: mark it `aria-hidden="true"` (`Prompt` and `CliOutput` do)
  and keep a real heading or link text for screen readers.
- Typed commands: the script also accepts `ls` (same as `help`), `clear`, Tab completion (listing the options when several fit), Up/Down history and
  Escape; anything else gets a fixed "command not found" message. Typed text is never
  echoed back. A command that works shows nothing under the prompt (its "Showing ..."
  message is for screen readers only); errors and Tab's list show. As in the fish shell,
  the rest of the one command that fits what's typed appears in grey after the cursor
  (`.cli-ghost`; Tab or the right arrow accepts it), and if nothing is typed for 10
  seconds a grey `try: whoami` hint appears there once. Typing anywhere on the page goes into the command box. With the script,
  the box loses its border and gets a block cursor (`.cli-caret`, placed by `cli.js`);
  the cursor is the focus indicator (solid when focused, outlined when not).
- Easter eggs: an ASCII-art note in an HTML comment at the top of every page (in
  `BaseLayout.astro`), `public/humans.txt`, a line in `security.txt`, and a "command not
  found" 404 page (with one link home). In the command box, the only one (Nate, Oct 2026)
  is "Nice try, sucka!!" for `sudo` or anything that looks like code injection (`ATTACK`
  in `public/cli.js`; it could never work, since typed text is only compared, never run or
  shown).

- Styles: `src/styles/global.css` (colour tokens at the top; both themes checked for
  WCAG AA contrast, so re-check if you change a colour). Font: JetBrains Mono,
  self-hosted OFL files in `public/fonts/` with the license; `@font-face` rules in
  `src/styles/fonts.css`.
- Pages: `src/pages/` (`index.astro`, the terminal; `404`, the only other page, with a
  header prompt linking home). Shared pieces: `src/components/` (`CliOutput`, `StoryItem`,
  `Episode`, `Placeholder`, `PersonJsonLd`, `Prompt`). The command box: `public/cli.js`.

## Never commit

Drafts, source notes, unpublished documents, secrets, real phone numbers, or images/PDFs
that haven't been scrubbed of metadata (EXIF/GPS, PDF author/revision history).
Public repo history is permanent.
