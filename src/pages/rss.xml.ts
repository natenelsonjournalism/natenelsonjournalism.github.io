// RSS feed of new work at /rss.xml: investigations, features and podcast episodes.
// Written by hand (a few lines) rather than adding a dependency; every text value is
// XML-escaped.
import type { APIRoute } from 'astro';
import { SITE } from '../config/site';
import { getFeatures, getInvestigations, getPodcasts, storyLink } from '../lib/content';

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

interface Item {
  title: string;
  link: string;
  guid: string;
  date: Date;
  description: string;
  category: string;
}

export const GET: APIRoute = async () => {
  const items: Item[] = [];
  for (const inv of await getInvestigations()) {
    const { title, outlet, date, summary } = inv.data;
    const link = storyLink(inv).href ?? inv.data.url;
    items.push({ title, link, guid: `investigation-${inv.id}`, date, description: `${summary} (${outlet})`, category: 'Investigation' });
  }
  for (const story of await getFeatures()) {
    const { title, outlet, date, url, summary } = story.data;
    const link = storyLink(story).href ?? url;
    items.push({ title, link, guid: `feature-${story.id}`, date, description: `${summary} (${outlet})`, category: 'Feature' });
  }
  for (const show of await getPodcasts()) {
    for (const [i, ep] of show.data.episodes.entries()) {
      if (!ep.date) continue;
      const link = ep.url ?? show.data.links.website ?? `${SITE.url}/#show-${show.id}`;
      const description = ep.summary ? `${ep.summary} (${show.data.name})` : show.data.name;
      items.push({ title: ep.title, link, guid: `episode-${show.id}-${ep.date.toISOString().slice(0, 10)}-${i}`, date: ep.date, description, category: 'Podcast' });
    }
  }
  items.sort((a, b) => b.date.getTime() - a.date.getTime());

  const body = items.map((item) =>
    [
      '    <item>',
      `      <title>${escape(item.title)}</title>`,
      `      <link>${escape(item.link)}</link>`,
      `      <guid isPermaLink="false">${escape(item.guid)}</guid>`,
      `      <pubDate>${item.date.toUTCString()}</pubDate>`,
      `      <description>${escape(item.description)}</description>`,
      `      <category>${item.category}</category>`,
      '    </item>',
    ].join('\n'),
  );

  const lastBuild = items[0]?.date ?? new Date(0);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(`${SITE.name}: new work`)}</title>
    <link>${SITE.url}/</link>
    <atom:link href="${SITE.url}/rss.xml" rel="self" type="application/rss+xml" />
    <description>${escape(`New journalism and podcasts by ${SITE.name}.`)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>
${body.join('\n')}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
