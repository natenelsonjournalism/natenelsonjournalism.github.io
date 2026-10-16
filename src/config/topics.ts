// The fixed topic vocabulary for clips. This is the only place topics are defined:
// the content schema rejects anything not listed here, and the Work page builds one
// filter page per topic (e.g. /work/topic/ransomware/).
//
// To add a topic, add a line below. The key is what you type in clips.yaml (lowercase,
// hyphens, no spaces) and also the URL slug; the value is the label shown on the site.
export const TOPICS = {
  ransomware: 'Ransomware',
  'nation-state': 'Nation-state hacking',
  vulnerabilities: 'Vulnerabilities',
  privacy: 'Privacy',
  policy: 'Policy',
  cybercrime: 'Cybercrime',
  'ai-security': 'AI security',
} as const;

export type Topic = keyof typeof TOPICS;

export const TOPIC_SLUGS = Object.keys(TOPICS) as [Topic, ...Topic[]];
