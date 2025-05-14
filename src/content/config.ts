import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.string(),
    author: z.string(),
    tags: z.array(z.string()),
    keywords: z.array(z.string()),
    image: z.string().optional(),
    canonicalUrl: z.string(),
  }),
});

export const collections = {
  blog,
};
