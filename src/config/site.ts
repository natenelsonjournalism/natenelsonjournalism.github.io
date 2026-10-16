// Site-wide details: name, bios and contact channels. Everything Nate needs to fill in
// lives here. A value set to `null` renders as a clearly marked placeholder on the site,
// so nothing fake is ever presented as real.

export const SITE = {
  name: 'Nate Nelson',
  role: 'Cybersecurity journalist',
  url: 'https://natenelsonjournalism.github.io',

  /** Homepage pitch: two sentences. */
  pitch: [
    'I report on cybersecurity: ransomware crews, state-backed hackers, the vulnerabilities they exploit, and the policy fights that follow.',
    'My work explains how attacks happen and who they hurt, for readers who don’t live in a security operations center.',
  ],

  /** Default meta description for pages that don't set their own. */
  description:
    'Nate Nelson is a cybersecurity journalist covering ransomware, nation-state hacking, vulnerabilities, and the policy fights around them.',
} as const;

/**
 * Professional profiles: shown to search engines as "the same person" (JSON-LD sameAs).
 * Use full https:// links, e.g. { label: 'LinkedIn', url: 'https://www.linkedin.com/in/...' }.
 * Include author pages at outlets here too.
 */
export const PROFILES: { label: string; url: string }[] = [];

/** Bios in three lengths (About page). `null` = not written yet. */
export const BIOS: { oneLine: string | null; short: string | null; long: string[] | null } = {
  // ~1 line, for bylines and introductions.
  oneLine: null,
  // ~75 words, for event programs and contributor notes.
  short: null,
  // ~250 words, one string per paragraph, for the About page itself.
  long: null,
};

/**
 * Downloadable files and images. Paths are relative to `public/`.
 * Strip metadata (EXIF/GPS, PDF author and revision history) before adding any file:
 * see "Never commit" in CLAUDE.md.
 */
export const FILES: { cv: string | null; pgpKey: string | null } = {
  cv: null, // e.g. '/nate-nelson-cv.pdf'
  pgpKey: null, // e.g. '/nate-nelson-pgp.asc'
};

/** Contact channels (Contact page). `null` = not set up yet. */
export const CONTACT: {
  email: string | null;
  signal: string | null;
  pgpFingerprint: string | null;
  secureDrop: { label: string; url: string } | null;
} = {
  email: null, // a dedicated address for editors and event organizers
  signal: null, // a Signal *username* (never a phone number), e.g. 'natenelson.01'
  pgpFingerprint: null, // full 40-character fingerprint; spaces are fine
  secureDrop: null, // e.g. { label: 'Example Outlet SecureDrop', url: 'https://...' }
};
