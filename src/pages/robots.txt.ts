import type { APIRoute } from "astro";
export const GET: APIRoute = ({ url }) => new Response(`User-agent: *\nAllow: /\nDisallow: /_emdash/\nDisallow: /api/\n\nSitemap: ${url.origin}/sitemap.xml\n`, { headers: { "content-type": "text/plain; charset=utf-8" } });
