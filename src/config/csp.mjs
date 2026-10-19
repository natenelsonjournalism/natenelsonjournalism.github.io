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

export const CSP = [
  "default-src 'none'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "manifest-src 'self'",
  ...(AUDIO_HOSTS.length ? [`media-src ${AUDIO_HOSTS.join(' ')}`] : []),
  "script-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  'upgrade-insecure-requests',
].join('; ');

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
