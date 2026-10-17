// Content collections and their schemas. Astro checks every entry against these at
// build time, so a missing field or a misspelled topic stops the build with a message
// naming the file, the entry and the field.
import { defineCollection } from 'astro:content';
import { file, glob, type Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { AUDIO_HOSTS, isAllowedAudioUrl } from './config/csp.mjs';

/**
 * Astro's file() loader, but strict: it only *logs* a YAML syntax error, a missing id
 * or a duplicate id and carries on (a typo would silently drop every clip from the
 * site). This wrapper turns those log messages into a build failure.
 *
 * With `ordered`, each entry also gets an `order` number (0, 1, 2...) from its position in
 * the file, because Astro otherwise returns entries sorted by id. Used where Nate controls
 * the order by hand (podcasts, projects).
 */
function strictFile(fileName: string, { ordered = false } = {}): Loader {
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
      let position = 0;
      const parseData: typeof context.parseData = (props) =>
        context.parseData({ ...props, data: { ...props.data, order: position++ } });
      await inner.load({ ...context, logger, ...(ordered && { parseData }) });
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

// Fields shared by every published story (investigations and features).
const linkStatus = z
  .enum(['live', 'dead'], { error: 'link_status must be "live" or "dead".' })
  .default('live');

// A file in public/, written as a site path, e.g. "/images/podcasts/my-show.jpg".
const sitePath = z.string().regex(/^\/[^/]/, {
  error: 'Must be a path to a file in public/, starting with "/" (e.g. "/images/podcasts/show.jpg").',
});

const audioUrl = httpsUrl.refine((url) => isAllowedAudioUrl(url), {
  error: (issue) =>
    `The audio host of "${String(issue.input)}" isn't allowed yet. Add it to AUDIO_HOSTS in ` +
    `src/config/csp.mjs (currently: ${AUDIO_HOSTS.length ? AUDIO_HOSTS.join(', ') : 'none'}).`,
});

// Investigative pieces: one Markdown file each, holding a short write-up.
const investigations = defineCollection({
  loader: strictGlob({ pattern: '**/*.md', base: './src/content/investigations' }),
  schema: z
    .object({
      title: z.string().min(1),
      outlet: z.string().min(1),
      date,
      url: httpsUrl,
      archive_url: httpsUrl.optional(),
      link_status: linkStatus,
      summary: z.string().min(1),
      impact: z.array(z.string().min(1)).min(1, { error: 'List at least one impact.' }),
      featured: z.boolean().default(false),
    })
    .strict(),
});

const features = defineCollection({
  loader: strictFile('src/data/features.yaml'),
  schema: z
    .object({
      id: slug,
      title: z.string().min(1),
      outlet: z.string().min(1),
      date,
      url: httpsUrl,
      archive_url: httpsUrl.optional(),
      link_status: linkStatus,
      summary: z.string().min(1),
      featured: z.boolean().default(false),
    })
    .strict(),
});

const episode = z
  .object({
    title: z.string().min(1),
    date,
    summary: z.string().min(1).optional(),
    // Direct link to the episode's audio file (from the show's RSS feed).
    audio: audioUrl.optional(),
    // The episode's own web page, if it has one.
    url: httpsUrl.optional(),
    transcript: httpsUrl.optional(),
  })
  .strict();

const podcasts = defineCollection({
  loader: strictFile('src/data/podcasts.yaml', { ordered: true }),
  schema: z
    .object({
      order: z.number().int(), // set automatically from the position in the file
      id: slug,
      name: z.string().min(1),
      role: z.string().min(1),
      years: z.string().min(1).optional(),
      description: z.string().min(1),
      cover: sitePath.optional(),
      links: z
        .object({ spotify: httpsUrl.optional(), apple: httpsUrl.optional(), website: httpsUrl.optional() })
        .strict()
        .default({}),
      episodes: z.array(episode).default([]),
    })
    .strict(),
});

const projects = defineCollection({
  loader: strictFile('src/data/projects.yaml', { ordered: true }),
  schema: z
    .object({
      order: z.number().int(), // set automatically from the position in the file
      id: slug,
      name: z.string().min(1),
      summary: z.string().min(1),
      url: httpsUrl.optional(),
      year: z.union([z.string().min(1), z.number().int()]).transform(String).optional(),
      image: sitePath.optional(),
      image_alt: z.string().optional(),
      featured: z.boolean().default(false),
    })
    .strict()
    .refine((p) => !p.image || p.image_alt !== undefined, {
      error: 'A project with an image needs image_alt (a short description; "" if purely decorative).',
    }),
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

export const collections = { investigations, features, podcasts, projects, appearances };
