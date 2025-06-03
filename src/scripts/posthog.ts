// Type definitions for PostHog
interface PostHogConfig {
    api_host: string;
    persistence?: string;
    cookie_name?: string;
    persistence_name?: string;
    autocapture?: boolean;
    cross_subdomain_cookie?: boolean;
    secure_cookie?: boolean;
    loaded?: (posthog: any) => void;
    bootstrap?: any;
    [key: string]: any;
}

declare global {
    interface Window {
        posthog: any;
    }
}

const POSTHOG_API_KEY = 'phc_7o2uZwISUxOtzUOUbilRsrGaImrah9WuIO2BtEJgsyu';
const POSTHOG_CONFIG: PostHogConfig = {
    api_host: 'https://eu.i.posthog.com',
    persistence: 'localStorage',
    cookie_name: '_ph_pcmemoryfinder',
    persistence_name: '_ph_pcmemoryfinder',
    autocapture: true,
    cross_subdomain_cookie: false,
    secure_cookie: true,
    loaded: (posthog) => {
        // Disable automatic capturing of pageviews to prevent double tracking
        posthog.config.capture_pageview = false;
        // Manually capture the initial pageview
        try {
            posthog.capture('$pageview');
        } catch (error) {
            console.warn('Failed to capture initial pageview:', error);
        }
    }
};

export function initializePostHog(): void {
    try {
        // Skip if not in browser
        if (typeof window === 'undefined') return;

        // Skip if already initialized
        if (window.posthog?.__loaded) return;

        // Initialize PostHog array
        const posthog = window.posthog = window.posthog || [];
        
        if (posthog.__SV) return;
        
        // Add methods to the PostHog instance
        const methods = [
            'init', 'capture', 'identify', 'register', 'register_once', 'unregister',
            'opt_in_capturing', 'opt_out_capturing', 'has_opted_in_capturing',
            'has_opted_out_capturing', 'reset', 'group', 'page', 'track'
        ];

        for (const method of methods) {
            posthog[method] = (...args: any[]) => {
                posthog.push([method, ...args]);
            };
        }

        // Load the PostHog script
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = true;
        script.src = `${POSTHOG_CONFIG.api_host}/static/array.js`;
        script.onerror = () => {
            console.warn('Failed to load PostHog script');
        };

        // Insert the script into the DOM
        const firstScript = document.getElementsByTagName('script')[0];
        firstScript?.parentNode?.insertBefore(script, firstScript);

        // Initialize PostHog with configuration
        posthog.init(POSTHOG_API_KEY, POSTHOG_CONFIG);
        
        // Mark as loaded
        posthog.__SV = 1;

    } catch (error) {
        console.warn('Failed to initialize PostHog:', error);
    }
} 