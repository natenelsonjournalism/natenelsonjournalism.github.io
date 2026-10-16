// Content collections and their schemas. Astro checks every entry against these at
// build time, so a missing field or a misspelled topic stops the build with a message
// naming the file, the entry and the field.
import { defineCollection, reference } from 'astro:content';
import { file, glob, type Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { TOPIC_SLUGS } from './config/topics';

/**
 * Astro's file() loader, but strict: it only *logs* a YAML syntax error, a missing id
 * or a duplicate id and carries on (a typo would silently drop every clip from the
 * site). This wrapper turns those log messages into a build failure.
 */
function strictFile(fileName: string): Loader {
  const inner = file(fileName);
  return {
    name: 'strict-file',
    async load(context) {
      const problems: string[] = [];
      const details: string[] = [];
      const logger = Object.create(context.logger) as typeof context.logger;
      logger.error = (message) => problems.push(message);
      logger.warn = (message) => {
        if (!message.startsWith('No items found')) problems.push(message);
      };
      logger.debug = (message) => {
        details.push(message);
        context.logger.debug(message);
      };
      await inner.load({ ...context, logger });
      if (problems.length) {
        const lines = [`Problem in ${fileName}:`, ...problems];
        if (problems.some((p) => p.startsWith('Error reading data'))) {
          lines.push(details.at(-1) ?? '', 'Tip: text containing a colon followed by a space (": ") must be wrapped in "double quotes".');
        }
        throw new Error(lines.join('\n'));
      }
    },
  };
}

/**
 * Astro's glob() loader, but strict: if a Markdown file fails to render, Astro only
 * logs an error and publishes the page without its text. This turns that into a
 * build failure.
 */
function strictGlob(options: Parameters<typeof glob>[0]): Loader {
  const inner = glob(options);
  return {
    name: 'strict-glob',
    async load(context) {
      const problems: string[] = [];
      const logger = Object.create(context.logger) as typeof context.logger;
      logger.error = (message) => problems.push(message);
      await inner.load({ ...context, logger });
      if (problems.length) throw new Error([`Problem in ${options.base}:`, ...problems].join('\n'));
    },
  };
}

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    error: 'Use lowercase letters, numbers and hyphens only (e.g. "outlet-2026-ransomware-gang").',
  });

const httpsUrl = z.url({
  protocol: /^https$/,
  error: 'Must be a full https:// link (e.g. "https://example.com/story").',
});

// YAML turns an unquoted 2026-09-18 into a date; a quoted "2026-09-18" stays text.
// Accept both, but nothing looser (z.coerce.date() would accept "April 2026").
const dateMessage = 'Must be a date written as YYYY-MM-DD (e.g. 2026-09-18).';
const date = z
  .union([z.date(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: dateMessage })], { error: dateMessage })
  .transform((value) => (value instanceof Date ? value : new Date(`${value}T00:00:00Z`)))
  .refine((value) => !Number.isNaN(value.getTime()), { error: dateMessage });

const topic = z.enum(TOPIC_SLUGS, {
  error: (issue) =>
    `Unknown topic "${String(issue.input)}". Allowed topics: ${TOPIC_SLUGS.join(', ')}. ` +
    'To add a new one, edit src/config/topics.ts.',
});

const clips = defineCollection({
  loader: strictFile('src/data/clips.yaml'),
  schema: z
    .object({
      id: slug,
      title: z.string().min(1),
      outlet: z.string().min(1),
      date,
      url: httpsUrl,
      archive_url: httpsUrl.optional(),
      topics: z.array(topic).min(1, { error: 'List at least one topic.' }),
      summary: z.string().min(1),
      featured: z.boolean().default(false),
      link_status: z.enum(['live', 'dead'], { error: 'link_status must be "live" or "dead".' }).default('live'),
    })
    .strict(),
});

const investigations = defineCollection({
  loader: strictGlob({ pattern: '**/*.md', base: './src/content/investigations' }),
  schema: z
    .object({
      title: z.string().min(1),
      date,
      outlets: z.array(z.string().min(1)).min(1, { error: 'List at least one outlet.' }),
      related_clips: z.array(reference('clips')).default([]),
      impact: z.array(z.string().min(1)).min(1, { error: 'List at least one impact.' }),
      summary: z.string().min(1),
    })
    .strict(),
});

const appearances = defineCollection({
  loader: strictFile('src/data/appearances.yaml'),
  schema: z
    .object({
      id: slug,
      title: z.string().min(1),
      event_or_show: z.string().min(1),
      date,
      type: z.enum(['talk', 'podcast', 'tv', 'radio', 'panel'], {
        error: 'type must be one of: talk, podcast, tv, radio, panel.',
      }),
      url: httpsUrl.optional(),
    })
    .strict(),
});

export const collections = { clips, investigations, appearances };
