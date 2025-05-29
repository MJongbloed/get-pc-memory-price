// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  site: 'https://pcmemoryfinder.com',
  trailingSlash: 'always',
  integrations: [
    tailwind(),
  ],
  redirects: {
    '/Computer-Memory-Chart': '/'
  },
  vite: {
    build: {
      target: 'esnext', // Target modern browsers
      minify: 'terser', // Use terser for better minification
      terserOptions: {
        compress: {
          drop_console: true, // Remove console.log statements
          drop_debugger: true // Remove debugger statements
        }
      }
    }
  },
  output: 'static'
});
