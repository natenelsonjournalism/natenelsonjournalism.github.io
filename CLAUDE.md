# CLAUDE.md

Portfolio site for Nate Nelson, cybersecurity journalist. Live at
https://natenelsonjournalism.github.io. `PLAN.md` is the build brief: work through
its phases in order and stop for review at the end of each one.

## Workflow

- Work on a branch, open a pull request, and stop. Nate squash-merges on github.com.
  Never push to `main`.
- `npm run build` runs `astro build` and then `scripts/verify-build.mjs`. Both must pass
  before pushing. CI runs the same command on every PR; pushes to `main` also deploy.
- Node version is pinned in `.nvmrc`. Install with `npm ci --ignore-scripts` (same as CI).

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

## Design

Clean, editorial, typography-led. Credible rather than "hacker aesthetic": no
green-on-black terminals or matrix effects. Homepage stays short. Light/dark via
`prefers-color-scheme`, both WCAG AA. Responsive to 320px. Visible focus styles.
No motion.

## Never commit

Drafts, source notes, unpublished documents, secrets, real phone numbers, or images/PDFs
that haven't been scrubbed of metadata (EXIF/GPS, PDF author/revision history).
Public repo history is permanent.
