// Helpers for reading content collections. Pages should use these rather than calling
// getCollection() directly, so sorting and link rules live in one place.
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

export type Clip = CollectionEntry<'clips'>;
export type Investigation = CollectionEntry<'investigations'>;
export type Appearance = CollectionEntry<'appearances'>;

const newestFirst = <T extends { data: { date: Date } }>(a: T, b: T) =>
  b.data.date.getTime() - a.data.date.getTime();

export async function getClips(): Promise<Clip[]> {
  return (await getCollection('clips')).sort(newestFirst);
}

export async function getInvestigations(): Promise<Investigation[]> {
  return (await getCollection('investigations')).sort(newestFirst);
}

export async function getAppearances(): Promise<Appearance[]> {
  return (await getCollection('appearances')).sort(newestFirst);
}

/**
 * Where a clip's title should link. A dead link with an archive copy points to the
 * archive and is labeled "(archived)"; a dead link without one is shown unlinked.
 */
export function clipLink(clip: Clip): { href: string | undefined; archived: boolean } {
  const { url, archive_url, link_status } = clip.data;
  if (link_status === 'live') return { href: url, archived: false };
  if (archive_url) return { href: archive_url, archived: true };
  return { href: undefined, archived: false };
}

/** Resolves an investigation's related_clips, failing the build on an unknown clip id. */
export async function getRelatedClips(investigation: Investigation): Promise<Clip[]> {
  const clips: Clip[] = [];
  for (const ref of investigation.data.related_clips) {
    const clip = await getEntry(ref);
    if (!clip) {
      throw new Error(
        `Investigation "${investigation.id}" lists related clip "${ref.id}", ` +
          'but no clip with that id exists in src/data/clips.yaml.',
      );
    }
    clips.push(clip);
  }
  return clips.sort(newestFirst);
}

const dateFormat = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

/** Formats a content date (stored as UTC midnight) as e.g. "September 18, 2026". */
export function formatDate(date: Date): string {
  return dateFormat.format(date);
}

/** Machine-readable date for <time datetime="">. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** URL-safe slug, e.g. "Example Gazette (defunct)" → "example-gazette-defunct". */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface Outlet {
  name: string;
  slug: string;
  count: number;
}

/** Every outlet with at least one clip, most clips first. Fails on slug collisions. */
export function getOutlets(clips: Clip[]): Outlet[] {
  const bySlug = new Map<string, Outlet>();
  for (const clip of clips) {
    const name = clip.data.outlet;
    const slug = slugify(name);
    const existing = bySlug.get(slug);
    if (existing && existing.name !== name) {
      throw new Error(
        `Outlets "${existing.name}" and "${name}" would share the page /work/outlet/${slug}/. ` +
          'Use exactly the same spelling for the same outlet in src/data/clips.yaml.',
      );
    }
    if (existing) existing.count++;
    else bySlug.set(slug, { name, slug, count: 1 });
  }
  return [...bySlug.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Years that have clips, newest first. */
export function getYears(clips: Clip[]): number[] {
  return [...new Set(clips.map((c) => c.data.date.getUTCFullYear()))].sort((a, b) => b - a);
}

/** Groups already-sorted clips by year, preserving order. */
export function groupByYear(clips: Clip[]): { year: number; clips: Clip[] }[] {
  const groups: { year: number; clips: Clip[] }[] = [];
  for (const clip of clips) {
    const year = clip.data.date.getUTCFullYear();
    const last = groups.at(-1);
    if (last?.year === year) last.clips.push(clip);
    else groups.push({ year, clips: [clip] });
  }
  return groups;
}
