import typography from '@tailwindcss/typography';

// Define the default sans-serif font stack directly
// const defaultSans = [...]; // We can remove this now

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            maxWidth: '94ch',
            // --- COLORS FOR LIGHT MODE --- 
            '--tw-prose-body': theme('colors.gray.700'),          
            '--tw-prose-headings': theme('colors.gray.900'),      
            '--tw-prose-links': theme('colors.blue.600'),        
            // --- COLORS FOR DARK MODE (Forcing Dark Text) --- 
            '--tw-prose-invert-body': theme('colors.gray.900'),    // Dark body (Dark Mode)
            '--tw-prose-invert-headings': theme('colors.gray.900'), // Dark headings (Dark Mode)
            '--tw-prose-invert-links': theme('colors.gray.900'),   // Dark links (Dark Mode)
            lineHeight: '1.7', 
            // --- LINK STYLES --- 
            a: {
              // Use CSS variables to respect light/dark mode link colors
              color: 'var(--tw-prose-links)',
              textDecoration: 'underline',    
              fontWeight: '500',
              '&:hover': {
                // Set hover explicitly for light mode
                color: theme('colors.blue.800'), 
              },
            },
            // --- BOLD TEXT COLOR --- 
            strong: {
              // Use CSS variable to respect light/dark mode body colors
              color: 'var(--tw-prose-headings)', // Match heading color for emphasis
              fontWeight: '600', // Default prose weight is often 600
            },
          },
        },
      }),
    },
  },
  plugins: [
    typography,
  ],
} 