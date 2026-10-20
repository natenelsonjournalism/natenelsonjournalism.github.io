# Portfolio Site: Build Plan

Professional portfolio for Nate Nelson, cybersecurity journalist.
Live URL: **https://natenelsonjournalism.github.io**

This file is the brief for Claude Code. Work through the phases in order, one at a time. At the end of each phase, run the checks listed, summarize what changed, and stop for review before starting the next phase.

**Workflow:** everything is done in the browser. Claude Code (web) works in a cloud sandbox on a branch, runs the build and checks there, and opens a pull request. Nate reviews and **squash-merges** the PR on github.com; GitHub Actions then deploys to the live site. Claude Code never pushes directly to `main`.

---

## Part A: Manual setup (Nate does these in the browser before starting)

These happen in GitHub's web settings. Claude Code can't do them from inside the repo. Nothing needs to be installed locally.

### Accounts and security
- [ ] On your personal GitHub account: enable 2FA with a hardware security key or passkey. Save recovery codes offline.
- [ ] Create a free organization named `natenelsonjournalism` (github.com → "+" → New organization → Free plan).
- [ ] Org settings → Authentication security → **Require two-factor authentication**.
- [ ] Org People page → set your own membership to **Private**.
- [ ] In GitHub email settings, turn on **Keep my email addresses private** so your personal email isn't in public commit history.

### Repository
- [ ] In the org, create a **public** repo named exactly `natenelsonjournalism.github.io`, initialized with a README.
- [ ] Upload this `PLAN.md` to the repo root through the GitHub web interface (Add file → Upload files).
- [ ] Repo Settings → General → Pull Requests: allow **squash merging only** (uncheck merge commits and rebase merging). GitHub signs squash-merge commits made in the browser, so `main` gets signed history with no key setup.
- [ ] Repo Settings → Pages → Build and deployment → Source: **GitHub Actions**.
- [ ] Repo Settings → Security: enable **Dependabot alerts**, **Dependabot security updates**, **Secret scanning**, and **Push protection**.
- [ ] Settings → Rules → add a ruleset for `main` that **requires a pull request before merging**, **blocks force pushes**, **blocks deletion**, and **requires signed commits**. (No required approvals needed; you're the only reviewer.)
- [ ] After the first successful deploy: Settings → Pages → confirm **Enforce HTTPS** is on.

### Claude Code (web)
- [ ] Connect Claude Code on the web to GitHub, and when GitHub asks which account to install Claude's app on, choose the **`natenelsonjournalism` org** and grant access to only this repo.
- [ ] Start a session on the repo and say: *"Read PLAN.md. Start Phase 1. Work on a branch, run the checks, open a PR, and stop."*

### Content to gather (can happen in parallel with Phases 1–3)
- [ ] Clips list: headline, outlet, publish date, URL, 1–2 topics, one-sentence summary. A spreadsheet is fine; Claude Code can convert it.
- [ ] 3–5 stories to feature on the homepage.
- [ ] 2–4 investigations worth a case study, with their impact (patches, CVEs, policy changes, lawsuits, awards, follow-up coverage).
- [ ] Bio in three lengths: one line, ~75 words, ~250 words.
- [ ] Headshot (**strip EXIF/location metadata** before adding it).
- [ ] CV as PDF (**strip document metadata**: author, revision history).
- [ ] Speaking/media appearances: event or show, date, link.
- [ ] Secure contact details: Signal username (not phone number), PGP public key file + full fingerprint, SecureDrop link if your outlet has one, a dedicated contact email.

---

## Part B: Project decisions (for Claude Code)

- **Framework:** Astro, latest stable release, static output only (`output: 'static'`).
- **Hosting:** GitHub Pages, deployed by a GitHub Actions workflow using GitHub's official Pages actions. No stored secrets.
- **Zero JavaScript in the shipped site.** No client-side scripts at all. This lets the CSP use `script-src 'none'`, and it's a deliberate design choice, not a limitation to work around.
  - Filtering on the Work page is done with **statically generated pages** (e.g. `/work/topic/ransomware/`, `/work/outlet/wired/`, `/work/year/2025/`), not client-side JS.
  - Dark/light mode follows the visitor's system setting via `prefers-color-scheme`. No toggle.
- **No third-party requests of any kind.** Self-host fonts (open-licensed woff2 files committed to the repo), images, and the PGP key. No analytics, no embeds, no CDN links, no social widgets.
- **Minimal dependencies.** Ask before adding any npm package beyond Astro and its official integrations. Prefer a few lines of our own code over a new dependency.
- **Design direction:** clean, editorial, typography-led. Credible rather than "hacker aesthetic": no green-on-black terminals, no matrix effects. The homepage stays short.

---

## Part C: Phases

### Phase 1: Scaffold and deploy pipeline

Goal: an empty-but-real site live at the URL, with the security baseline in place from day one.

1. Initialize an Astro project (minimal template, TypeScript strict).
2. Configure `astro.config.mjs`: `site: 'https://natenelsonjournalism.github.io'`, static output, `build.inlineStylesheets: 'never'`, and any setting needed so the build produces **no inline scripts or styles**.
3. Create a base layout with:
   - `<meta charset>`, viewport, `<title>`, description.
   - CSP meta tag:
     `default-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'; manifest-src 'self'; script-src 'none'; base-uri 'none'; form-action 'none'; upgrade-insecure-requests`
   - `<meta name="referrer" content="strict-origin-when-cross-origin">`
   - A skip-to-content link and semantic landmarks (`header`, `nav`, `main`, `footer`).
4. Add `.github/workflows/deploy.yml`:
   - Triggers on push to `main` and manual dispatch.
   - Top-level `permissions: {}`; the build job gets `contents: read`; the deploy job gets `pages: write` and `id-token: write`.
   - Uses `actions/checkout`, `actions/setup-node`, `npm ci`, `npm run build`, `actions/upload-pages-artifact`, `actions/deploy-pages`.
   - **Every action pinned to a full commit SHA**, with the version in a trailing comment.
5. Add `.github/dependabot.yml` covering `npm` and `github-actions`, weekly.
6. Add a `scripts/verify-build.mjs` (plain Node, no dependencies) that runs after `npm run build` and **fails the build** if any page in `dist/`:
   - lacks the CSP meta tag,
   - contains a `<script>` element, an inline `<style>` element, a `style=""` attribute, or an `on*=` event-handler attribute,
   - references any `src`, `srcset`, `href` on `<link>`, or CSS `url()` pointing to a host other than our own.
   (Outbound `<a href>` links to articles are allowed.)
   Wire it into `npm run build` (or a `postbuild` script) and into the CI workflow.
7. Create `CLAUDE.md` summarizing these conventions for future sessions.
8. Add a placeholder homepage. Commit to a branch and open a PR. Also have the deploy workflow's build job run on pull requests (build and `verify-build` only, no deploy) so every PR shows a pass/fail check.

**Checks:** `npm run build` passes in the sandbox, including `verify-build`; the PR check is green. After Nate squash-merges: the deploy workflow succeeds and the live URL serves the placeholder page over HTTPS.

### Phase 2: Content model

1. Define content collections in the Astro content config with schemas validated at build time:
   - **clips**: a single `src/data/clips.yaml` file. Fields: `id`, `title`, `outlet`, `date`, `url`, `archive_url` (optional), `topics` (list), `summary`, `featured` (bool, default false), `link_status` (`live` | `dead`, default `live`).
   - **investigations**: one Markdown file each in `src/content/investigations/`. Frontmatter: `title`, `date`, `outlets`, `related_clips` (list of clip ids), `impact` (list of short strings), `summary`. Body: the case study.
   - **appearances**: `src/data/appearances.yaml`. Fields: `title`, `event_or_show`, `date`, `type` (`talk` | `podcast` | `tv` | `radio` | `panel`), `url` (optional).
2. Define a fixed topic vocabulary (e.g. ransomware, nation-state, vulnerabilities, privacy, policy, cybercrime, AI security) in one place so filter pages stay consistent. The schema should reject unknown topics.
3. Populate each collection with 3–5 **clearly fake placeholder entries** (e.g. outlet "Example Outlet", URLs on `example.com`).
4. If a clip has `link_status: dead` and an `archive_url`, the site links to the archive copy and labels it "(archived)".
5. Add a short section to `CLAUDE.md`: "How to add a new clip" and "How to add an investigation."

**Checks:** build fails cleanly with a helpful message if a required field is missing or a topic is misspelled; placeholder data renders.

### Phase 3: Pages and design

Build these pages, in this order, sharing one layout and a small component set:

1. **Home** (`/`): name, two-sentence pitch, 3–5 featured clips, a short "Recent work" list (latest 5), a list of outlets written for (as text, not logos), links to Work and Contact. Keep it to roughly two screens on desktop.
2. **Work** (`/work/`): full clip list, newest first, grouped by year. Navigation to statically generated filter pages by topic, outlet, and year. Each clip shows title, outlet, date, topics, summary.
3. **Investigations** (`/investigations/` and `/investigations/[slug]/`): index of case studies plus individual pages showing impact prominently and listing related clips.
4. **About** (`/about/`): long bio, headshot, links to download the CV PDF and copy the short bio. Include the one-line and ~75-word bios in a clearly labeled "Bio for event organizers / editors" section.
5. **Speaking & Media** (`/speaking/`): appearances grouped by type, newest first.
6. **Contact** (`/contact/`): editor contact (email), secure channels for sources (Signal username, PGP key download + full fingerprint shown in monospace, SecureDrop link), and short plain-language guidance for first-time sources (use a personal device on a personal network, don't contact from work accounts, what Nate can and can't promise about confidentiality). Mark all of this content as placeholders for Nate to fill in.
7. **404 page.**

Design requirements:
- Typography-led layout, one self-hosted serif or sans for body plus one for headings at most. Fonts must be open-licensed (OFL) with the license file committed.
- Light and dark themes via `prefers-color-scheme`, both meeting WCAG AA contrast.
- Responsive down to 320px width; no horizontal scrolling.
- Visible keyboard focus styles; meaningful link text; `alt` on all images.
- Respects `prefers-reduced-motion` (ideally there's no motion at all).

**Checks:** all pages build and pass `verify-build`; manual keyboard walkthrough works; pages look right at phone and desktop widths in both color schemes.

### Phase 4: Discoverability and metadata

1. Per-page `<title>`, meta description, and canonical URL.
2. Open Graph and Twitter/X card tags using **one** static default share image (1200×630 PNG, committed to the repo). No image-generation dependency.
3. JSON-LD `Person` schema on Home and About (name, jobTitle, url, sameAs links to professional profiles).
4. `sitemap.xml` (official Astro sitemap integration is acceptable) and `robots.txt`.
5. RSS feed of clips at `/rss.xml` (official Astro RSS package is acceptable), linked from the footer and via `<link rel="alternate">`.
6. Favicon set (SVG + PNG fallback) and a minimal web manifest.

**Checks:** feed validates; sitemap lists every page; share preview looks right when the URL is pasted into a link-preview checker.

### Phase 5: Security extras and quality CI

1. `public/.well-known/security.txt` per RFC 9116: `Contact`, `Expires` (≤ 1 year out), `Encryption` (URL of the self-hosted PGP key), `Preferred-Languages`, `Canonical`.
2. Extend `verify-build` (or add a separate CI job) to **warn when `Expires` is within 60 days** and **fail when it has passed**.
3. Ensure all external `<a>` links carry `rel="noopener noreferrer"`.
4. Add a scheduled weekly workflow (`.github/workflows/links.yml`) that checks every clip URL for rot and, if any fail, opens or updates a single GitHub issue listing them. Read-only permissions except `issues: write`. Pin the action to a SHA. This must never block deploys.
5. Add a CI accessibility check against the built site (e.g. an axe- or pa11y-based check run via a dev dependency). It runs only in CI, never ships to the site, and its workflow has read-only permissions.
6. Confirm no file in the repo contains secrets, real phone numbers, or EXIF-bearing images (add an EXIF check for `public/` and `src/assets/` images to `verify-build` if practical without heavy dependencies).

**Checks:** all CI workflows green; scan the live site with Mozilla Observatory and note the results in `CLAUDE.md`, including which findings are GitHub Pages header limitations (e.g. `frame-ancestors`, `X-Content-Type-Options`) rather than site issues.

### Change of direction (October 2026, decided by Nate)

Before Phase 6, the site was reorganised around Nate's three kinds of work. This
replaces the clip-list design from earlier phases (topic/outlet/year filter pages,
`clips.yaml`, a separate Speaking page):

- **Journalism:** 3–5 investigations, each with a short write-up page, and 3–5 features,
  plus "full archive" links to Nate's author page at each outlet. No live author-page
  embedding (that would need scripts or fragile scraping).
- **Podcasts:** shows Nate has written and/or hosted, each with 2–3 standout episodes that
  play on the page in the browser's own audio player (`preload="none"`, nothing loads until
  play is pressed). Spotify/Apple embeds rejected: they load third-party scripts and
  trackers. Approved exception to "no third-party requests": audio from hosts listed in
  `AUDIO_HOSTS` (`src/config/csp.mjs`).
- **Projects:** a looser list of side projects.
- **About** absorbs Speaking & media.
- The site check runs monthly instead of weekly; security.txt expiry warns but never
  blocks a deploy.

### Phase 6: Real content and launch

1. Journalism: Nate's chosen investigations (with write-ups drafted from the published
   stories, for Nate to edit) and features; his author page URL(s) in `ARCHIVES`. Flag
   anything missing rather than guessing; add Wayback Machine `archive_url`s where useful.
2. Podcasts: shows, roles, descriptions, listen links, standout episodes with their audio
   URLs from each show's RSS feed; add the audio hosts to `AUDIO_HOSTS` and confirm playback
   on the Cloudflare preview. Cover art optional (metadata stripped).
3. Projects.
4. Replace all remaining placeholders: homepage pitch, bios, headshot, contact details
   (Signal username), profiles. Nate dropped the CV, PGP key, SecureDrop, public email and
   appearances for now (Oct 2026); the About page shows "Speaking and media" again once
   `appearances.yaml` has an entry.
5. Search the repo for any remaining placeholder text (`example.com`, "Example", "Placeholder")
   and list it.
6. Final review: proofread pages, re-run all checks, deploy.

**Checks:** zero placeholders remain; all checks pass; audio plays on the preview; live site
reviewed on phone and desktop.

---

## Ongoing maintenance

- **New work:** add an investigation, feature, episode or project (see "Content" in
  `CLAUDE.md`), commit, push. The site rebuilds automatically.
- **Dependabot PRs:** review and merge; the build's `verify-build` step guards against regressions.
- **Monthly site check:** when its issue appears, follow the fix steps it lists (e.g. mark a
  story `link_status: dead` and add an `archive_url`, or add a podcast audio host).
- **Every year:** bump `Expires` in `security.txt` (CI will remind you).
- **Never commit:** drafts, source notes, unpublished documents, or files you haven't scrubbed of metadata. Public repo history is permanent.
