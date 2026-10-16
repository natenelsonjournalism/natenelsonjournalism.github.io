// RSS feed of published clips at /rss.xml. Written by hand (a few lines) rather than
// adding a dependency; every text value is XML-escaped.
import type { APIRoute } from 'astro';
import { SITE } from '../config/site';
import { TOPICS } from '../config/topics';
import { clipLink, getClips } from '../lib/content';

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export const GET: APIRoute = async () => {
  const clips = await getClips();
  const items = clips.map((clip) => {
    const { title, outlet, date, url, topics, summary } = clip.data;
    const link = clipLink(clip).href ?? url;
    return [
      '    <item>',
      `      <title>${escape(title)}</title>`,
      `      <link>${escape(link)}</link>`,
      `      <guid isPermaLink="false">${escape(clip.id)}</guid>`,
      `      <pubDate>${date.toUTCString()}</pubDate>`,
      `      <description>${escape(`${summary} (${outlet})`)}</description>`,
      ...topics.map((t) => `      <category>${escape(TOPICS[t])}</category>`),
      '    </item>',
    ].join('\n');
  });

  const lastBuild = clips[0]?.data.date ?? new Date(0);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(`${SITE.name}: published work`)}</title>
    <link>${SITE.url}/work/</link>
    <atom:link href="${SITE.url}/rss.xml" rel="self" type="application/rss+xml" />
    <description>${escape(`New reporting by ${SITE.name}, ${SITE.role.toLowerCase()}.`)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>
${items.join('\n')}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
