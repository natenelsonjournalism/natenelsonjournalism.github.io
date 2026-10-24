// Single source of truth for the Content-Security-Policy.
// Used by src/layouts/BaseLayout.astro (emits the <meta> tag) and by
// scripts/verify-build.mjs (fails the build if any page lacks it).

/**
 * Podcast audio hosts. The site plays episodes with the browser's own <audio> player
 * (no embeds, no scripts), straight from the show's hosting company, and only once the
 * visitor presses play (preload="none"). Nate approved this one exception to "no
 * third-party requests". List every host an episode's audio address passes through,
 * including redirects (e.g. a stats prefix like www.podtrac.com, then the host's CDN):
 * the browser blocks any hop not listed here. A leading "*." covers subdomains.
 * The monthly site check follows each episode's redirects and reports any missing host.
 *
 * Example: ['https://www.podtrac.com', 'https://traffic.megaphone.fm', 'https://*.megaphone.fm']
 */
export const AUDIO_HOSTS = [
  // Darknet Diaries: Podtrac (download stats), then PRX's Dovetail and its CDN.
  'https://www.podtrac.com',
  'https://dovetail.prxu.org',
  'https://dovetail-cdn.prxu.org',
  // Malicious Life: Podscribe and Claritas (download stats), then RedCircle.
  'https://pscrb.fm',
  'https://clrtpod.com',
  'https://*.redcircle.com',
];

/** @param {string[]} scripts The script-src (and related) directives for one kind of page. */
const policy = (scripts) =>
  [
    "default-src 'none'",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "manifest-src 'self'",
    ...(AUDIO_HOSTS.length ? [`media-src ${AUDIO_HOSTS.join(' ')}`] : []),
    ...scripts,
    "base-uri 'none'",
    "form-action 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

/** Every page except the homepage: no scripts at all. */
export const CSP = policy(["script-src 'none'"]);

/**
 * The homepage only. It runs one script, our own /cli.js (the typed-command box; Nate
 * approved this in Oct 2026). 'self' allows files from this site and nothing else, and
 * still blocks inline scripts. Trusted Types (enforced by Chromium browsers) makes the
 * browser refuse any attempt to turn text into HTML or code, so even a mistake in cli.js
 * couldn't inject markup.
 */
export const CSP_CLI = policy(["script-src 'self'", "require-trusted-types-for 'script'", "trusted-types 'none'"]);

/** The one script the site ships, and the only page allowed to load it. */
export const CLI_SCRIPT = '/cli.js';
export const CLI_PAGE = '/';

/**
 * True if the CSP lets the browser load audio from this URL (https only).
 * @param {string} url
 */
export function isAllowedAudioUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  return AUDIO_HOSTS.some((source) => {
    const host = source.replace(/^https:\/\//, '');
    return host.startsWith('*.') ? parsed.hostname.endsWith(host.slice(1)) : parsed.host === host;
  });
}
