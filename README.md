# natenelsonjournalism.github.io

Portfolio site for Nate Nelson, cybersecurity journalist: https://natenelsonjournalism.github.io

Built with [Astro](https://astro.build) as a static site (one small first-party script, the homepage's command box) and deployed to
GitHub Pages by GitHub Actions. See `PLAN.md` for the build plan and `CLAUDE.md` for the
conventions and security rules.

```sh
npm ci --ignore-scripts
npm run dev     # local preview
npm run build   # build + security verification (scripts/verify-build.mjs)
```
