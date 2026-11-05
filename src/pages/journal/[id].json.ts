import { getPosts, summarize } from '../../lib/posts';
import { render } from 'astro:content';
import type { APIRoute } from 'astro';

export async function getStaticPaths() {
  return (await getPosts()).map((entry) => ({ params: { id: entry.id }, props: { entry } }));
}
export const GET: APIRoute = async ({ props }) => {
  const entry = props.entry;
  const { headings } = await render(entry);
  return new Response(JSON.stringify({ ...summarize(entry), html: entry.rendered?.html ?? '', headings }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
