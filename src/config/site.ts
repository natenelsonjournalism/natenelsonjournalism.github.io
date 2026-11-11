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
  'I’m a cybersecurity journalist and podcast writer. I cover news and investigations for Dark Reading, ' +
    'and I write long-form episodes of Darknet Diaries.',
  'I began my career ghostwriting Forbes and CNBC op-eds for tech and finance executives. In 2017 I ' +
    'co-created Malicious Life, a podcast about the history of cybersecurity, and went on to write nearly 150 ' +
    'episodes. The show reached the Top 20 technology charts on Apple Podcasts and Spotify, won a People’s ' +
    'Choice Podcast Award, and was named a Webby Awards honoree. In 2022 I transitioned to news reporting at ' +
    'Threatpost, before joining Dark Reading.',
  'My reporting has compelled the Vatican, mainstream tech companies, and US government agencies to fix ' +
    'cybersecurity vulnerabilities in their web infrastructure. Security researchers often bring their findings ' +
    'to me first, and my stories run alongside their own reports.',
  'I hold degrees from Bard College and New York University.',
];

/** The line at the top of `pod`, above the shows. */
export const PODCASTS_INTRO =
  'Since 2017 I’ve been writing, researching, and producing long-form documentary podcasts. ' +
  'Here are some examples of episodes I’ve written:';

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
