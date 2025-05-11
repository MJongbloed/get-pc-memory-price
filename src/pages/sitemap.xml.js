import { getCollection } from 'astro:content';

export async function GET() {
  const posts = await getCollection('blog');
  const pages = [
    '/',
    '/blog/',
    '/privacy-policy/',
    ...posts.map(post => `/blog/${post.slug}/`)
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${pages.map(page => `
  <url>
    <loc>https://pcmemoryfinder.com${page}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`).join('')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml'
    }
  });
} 