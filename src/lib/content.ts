// Helpers for reading content collections. Pages should use these rather than calling
// getCollection() directly, so sorting and link rules live in one place.
import { getCollection, type CollectionEntry } from 'astro:content';

export type Investigation = CollectionEntry<'investigations'>;
export type Feature = CollectionEntry<'features'>;
export type Podcast = CollectionEntry<'podcasts'>;
export type Project = CollectionEntry<'projects'>;
export type Appearance = CollectionEntry<'appearances'>;
export type Story = Investigation | Feature;

const fileOrder = <T extends { data: { order: number } }>(a: T, b: T) => a.data.order - b.data.order;

const newestFirst = <T extends { data: { date: Date } }>(a: T, b: T) =>
  b.data.date.getTime() - a.data.date.getTime();

export async function getInvestigations(): Promise<Investigation[]> {
  return (await getCollection('investigations')).sort(newestFirst);
}

export async function getFeatures(): Promise<Feature[]> {
  return (await getCollection('features')).sort(newestFirst);
}

/** Shows in the order they appear in podcasts.yaml; episodes newest first (undated ones last, in file order). */
export async function getPodcasts(): Promise<Podcast[]> {
  const shows = (await getCollection('podcasts')).sort(fileOrder);
  const time = (d: Date | undefined) => d?.getTime() ?? 0; // undated sorts last (stable: file order kept)
  for (const show of shows) show.data.episodes.sort((a, b) => time(b.date) - time(a.date));
  return shows;
}

/** Projects in the order they appear in projects.yaml. */
export async function getProjects(): Promise<Project[]> {
  return (await getCollection('projects')).sort(fileOrder);
}

export async function getAppearances(): Promise<Appearance[]> {
  return (await getCollection('appearances')).sort(newestFirst);
}

/** Page address of an investigation's write-up. */
export const investigationPath = (inv: Investigation) => `/journalism/${inv.id}/`;

/**
 * Where a story's original article link should point. A dead link with an archive copy
 * points to the archive and is labeled "(archived)"; a dead link without one is unlinked.
 */
export function storyLink(story: Story): { href: string | undefined; archived: boolean } {
  const { url, archive_url, link_status } = story.data;
  if (link_status === 'live') return { href: url, archived: false };
  if (archive_url) return { href: archive_url, archived: true };
  return { href: undefined, archived: false };
}

/** Homepage picks: the items marked `featured`, or the first few if none are. */
export function highlights<T extends { data: { featured: boolean } }>(items: T[], count: number): T[] {
  const featured = items.filter((i) => i.data.featured);
  return (featured.length ? featured : items).slice(0, count);
}

/** Formats a content date for display, log-style: e.g. "2026-09-18". */
export function formatDate(date: Date): string {
  return isoDate(date);
}

/** Machine-readable date for <time datetime="">. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
