// Markdown (Sätteri) plugin: adds rel="noopener noreferrer" to every off-site link in
// investigation write-ups, matching the links written in components. A few lines instead
// of a dependency. scripts/verify-build.mjs fails the build if any outbound link lacks it.

const SITE_HOST = 'natenelsonjournalism.github.io';

/** @param {unknown} href */
function isExternal(href) {
  if (typeof href !== 'string' || !/^(https?:)?\/\//i.test(href)) return false;
  try {
    return new URL(href, `https://${SITE_HOST}/`).host !== SITE_HOST;
  } catch {
    return false;
  }
}

/** @type {import('satteri').HastPluginDefinition} */
export const externalLinks = {
  name: 'external-links',
  element: {
    filter: ['a'],
    visit(node, ctx) {
      if (!isExternal(node.properties?.href)) return;
      const existing = node.properties?.rel;
      const rel = new Set(Array.isArray(existing) ? existing.map(String) : typeof existing === 'string' ? existing.split(/\s+/) : []);
      rel.add('noopener').add('noreferrer');
      ctx.setProperty(node, 'rel', [...rel].filter(Boolean));
    },
  },
};
