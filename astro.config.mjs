// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://pcmemoryfinder.com', // Add your site URL here
  integrations: [sitemap()],
  redirects: {
    '/Computer-Memory-Chart': '/'
  }
});
