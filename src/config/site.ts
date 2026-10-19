// Site-wide details: name, bios and contact channels. Everything Nate needs to fill in
// lives here. A value set to `null` renders as a clearly marked placeholder on the site,
// so nothing fake is ever presented as real.

export const SITE = {
  name: 'Nate Nelson',
  role: 'Cybersecurity journalist and podcast scriptwriter',
  url: 'https://natenelsonjournalism.github.io',

  /** Homepage pitch: two sentences. */
  pitch: [
    'I report on cybersecurity for Dark Reading and write scripts for podcasts, including Darknet Diaries.',
    'My reporting has gotten a leaking Vatican app fixed and named the vendor behind a government data breach.',
  ],

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

/** Bios in three lengths (About page). `null` = not written yet. */
export const BIOS: { oneLine: string | null; short: string | null; long: string[] | null } = {
  // ~1 line, for bylines and introductions.
  oneLine: 'Nate Nelson is a cybersecurity journalist and podcast scriptwriter.',
  // ~75 words, for event programs and contributor notes.
  short:
    'Nate Nelson is a cybersecurity journalist and podcast scriptwriter. He reports for Dark Reading, where his ' +
    'investigations got the Vatican’s official prayer app fixed after it exposed the data of more than 700,000 users, ' +
    'and identified the vendor behind a Scottish government data breach. He is a scriptwriter and researcher for ' +
    'Darknet Diaries, and co-created and wrote Malicious Life, a podcast about the history of cybersecurity.',
  // A few short paragraphs, one string each, for the About page itself.
  long: [
    'I’m a cybersecurity journalist and podcast scriptwriter. I report for Dark Reading on data breaches, ' +
      'vulnerabilities and the people who exploit them, and on how AI is changing both attack and defense.',
    'My investigations have pushed organizations to act. After I reported that the Vatican’s official prayer app ' +
      'was exposing the personal information of more than 700,000 users, it was fixed. When Scotland’s prosecution ' +
      'service disclosed a breach at an unnamed supplier, I identified the vendor.',
    'I also write for podcasts. I’m a scriptwriter and researcher for Darknet Diaries, and I co-created and wrote ' +
      'Malicious Life, which tells untold stories from the history of cybersecurity.',
    'Away from the news, I design games. Football: The Board Game simulates the sport and its strategy, on a ' +
      'tabletop or a phone.',
  ],
};

/**
 * Headshot on the About page: a path in `public/` plus a description for screen readers.
 * Strip metadata (EXIF/GPS) before adding any image: see "Never commit" in CLAUDE.md.
 */
export const HEADSHOT: { src: string; alt: string } | null = {
  src: '/images/nate-nelson.jpg',
  alt: 'Nate Nelson, smiling, in a suit and tie in front of a stone and brick wall.',
};

/** Contact channels (Contact page). `null` = not set up yet. No email, by Nate's choice. */
export const CONTACT: {
  signal: string | null;
} = {
  signal: 'natenelsonjournalism.01', // a Signal *username*, never a phone number
};
