// PostHog initialization script
declare global {
    interface Window {
        posthog: any;
    }
}

export function initializePostHog() {
    if (typeof window === 'undefined') return; // Skip if not in browser

    const posthog = window.posthog || [];
    
    if (posthog.__SV) return;
    
    window.posthog = posthog;
    posthog._i = [];
    
    posthog.init = function(apiKey: string, config: any, namespace?: string) {
        function registerMethod(obj: any, method: string) {
            const parts = method.split('.');
            if (parts.length === 2) {
                obj = obj[parts[0]];
                method = parts[1];
            }
            obj[method] = function() {
                obj.push([method].concat(Array.prototype.slice.call(arguments, 0)));
            };
        }

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.crossOrigin = 'anonymous';
        script.async = true;
        script.src = config.api_host.replace('.i.posthog.com', '-assets.i.posthog.com') + '/static/array.js';
        
        const firstScript = document.getElementsByTagName('script')[0];
        firstScript?.parentNode?.insertBefore(script, firstScript);

        const instance = posthog;
        const ns = namespace || 'posthog';
        
        instance.people = instance.people || [];
        instance.toString = function(stub?: boolean) {
            let name = 'posthog';
            if (ns !== 'posthog') name += '.' + ns;
            if (!stub) name += ' (stub)';
            return name;
        };
        
        instance.people.toString = function() {
            return instance.toString(true) + '.people (stub)';
        };

        const methods = "init me ws ys ps bs capture je Di ks register register_once register_for_session unregister unregister_for_session Ps getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty Es $s createPersonProfile Is opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing Ss debug xs getPageViewId captureTraceFeedback captureTraceMetric".split(" ");
        
        for (const method of methods) {
            registerMethod(instance, method);
        }

        posthog._i.push([apiKey, config, namespace]);
    };

    posthog.__SV = 1;

    // Initialize PostHog with configuration
    posthog.init('phc_7o2uZwISUxOtzUOUbilRsrGaImrah9WuIO2BtEJgsyu', {
        api_host: 'https://eu.i.posthog.com',
        person_profiles: 'identified_only'
    });
} 