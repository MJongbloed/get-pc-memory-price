// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  site: 'https://pcmemoryfinder.com', // Add your site URL here
  integrations: [
    sitemap(),
    tailwind(),
  ],
  redirects: {
    '/Computer-Memory-Chart': '/'
  }
});
