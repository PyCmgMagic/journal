import { getCollection } from 'astro:content';
import type { PostSummary } from './post-types';
export { categoryNames } from './post-types';
export async function getPosts() {
  return (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}
export function summarize(entry: Awaited<ReturnType<typeof getPosts>>[number]): PostSummary {
  return {
    slug: entry.id,
    title: entry.data.title,
    description: entry.data.description,
    date: entry.data.date.toISOString().slice(0, 10).replaceAll('-', '.'),
    category: entry.data.category,
    tags: entry.data.tags,
    demo: entry.data.demo,
    minutes: Math.max(1, Math.ceil((entry.body?.length ?? 0) / 450)),
  };
}
