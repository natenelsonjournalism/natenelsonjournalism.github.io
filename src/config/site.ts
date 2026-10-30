// Site-wide details: name, bios and contact channels. Everything Nate needs to fill in
// lives here. A value set to `null` renders as a clearly marked placeholder on the site,
// so nothing fake is ever presented as real.

export const SITE = {
  name: 'Nate Nelson',
  role: 'Cybersecurity journalist and podcast scriptwriter',
  url: 'https://natenelsonjournalism.github.io',

  /** The line under Nate's name at the top of the homepage. */
  tagline: 'Cybersecurity journalist, podcast scriptwriter',

  /** Default meta description for pages that don't set their own. */
  description:
    'Nate Nelson is a cybersecurity journalist and podcast scriptwriter, reporting for Dark Reading and writing for Darknet Diaries and Malicious Life.',
} as const;

/**
 * Professional profiles: shown to search engines as "the same person" (JSON-LD sameAs).
 * Use full https:// links, e.g. { label: 'LinkedIn', url: 'https://www.linkedin.com/in/...' }.
 */
export const PROFILES: { label: string; url: string }[] = [
  { label: 'LinkedIn', url: 'https://www.linkedin.com/in/nate-nelson-75589611b/' },
];

/**
 * "Full archive" links at the bottom of the Journalism page: your author page at each
 * outlet. Empty = a placeholder shows instead.
 */
export const ARCHIVES: { outlet: string; url: string }[] = [
  { outlet: 'Dark Reading', url: 'https://www.darkreading.com/author/nate-nelson' },
];

/** The About page text: one string per paragraph. `null` = not written yet. */
export const ABOUT: string[] | null = [
  'I’m a journalist and scriptwriter. I cover daily news for Dark Reading, the most widely read cybersecurity ' +
    'website among Chief Information Security Officers (CISOs). I also write long form stories for Darknet ' +
    'Diaries, the most popular show in cybersecurity across all media.',
  'I began my career as a freelancer, ghostwriting Forbes and CNBC op-eds for executives in tech and finance. ' +
    'Then I transitioned to journalism at Threatpost, where I began covering cybersecurity news and trends. ' +
    'Throughout those years I co-created a cybersecurity podcast, Malicious Life, which in its day climbed into ' +
    'the Top 20 technology podcasts charts on Apple Podcasts and Spotify.',
  'I hold degrees from New York University and Bard College.',
];

/**
 * Headshot: a path in `public/` plus a description for screen readers. `whoami` shows it
 * as ASCII art (drawn by scripts/portrait.py); the photo itself is only given to search
 * engines. Strip metadata (EXIF/GPS) before adding any image: see
 * "Never commit" in CLAUDE.md.
 */
export const HEADSHOT: { src: string; alt: string } | null = {
  src: '/images/nate-nelson.jpg',
  alt: 'Nate Nelson, smiling, in a suit and tie.',
};

/**
 * Contact page. `null` = not set up yet. No email, by Nate's choice. LinkedIn comes from PROFILES.
 * `signal` is a Signal *username* link (signal.me/#eu/...), never a phone-number link (#p/).
 */
export const CONTACT: {
  signal: string | null;
} = {
  signal: 'https://signal.me/#eu/F0OEcy7_duOY82vjqkvXsN16RFDcoIRwiqZQeoPV4F0FFXLzCY1LOoXfdfZdbNLx',
};
