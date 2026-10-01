// unknownphone.com Phone Query Plugin - Iframe Proxy Solution
(function (scope) {
    // --- Plugin Configuration ---
    const PLUGIN_CONFIG = {
        id: 'unknownphonePhoneNumberPlugin', // Unique ID for this plugin
        name: 'UnknownPhone Phone Lookup (Regex)',
        version: '1.1.1', // Modernized with Dio/Regex
        description: 'Queries unknownphone.com for phone number information using direct fetch and regex parsing.',
        config: {
            strategy: 'direct',
            successMarker: "unknownphone"
        },
    };

    // --- Our application's predefined labels (provided by the user) ---
    const predefinedLabels = [
        { label: 'Fraud Scam Likely' },
        { label: 'Spam Likely' },
        { label: 'Telemarketing' },
        { label: 'Robocall' },
        { label: 'Delivery' },
        { label: 'Takeaway' },
        { label: 'Ridesharing' },
        { label: 'Insurance' },
        { label: 'Loan' },
        { label: 'Customer Service' },
        { label: 'Unknown' },
        { label: 'Financial' },
        { label: 'Bank' },
        { label: 'Education' },
        { label: 'Medical' },
        { label: 'Charity' },
        { label: 'Other' },
        { label: 'Debt Collection' },
        { label: 'Survey' },
        { label: 'Political' },
        { label: 'Ecommerce' },
        { label: 'Risk' },
        { label: 'Agent' },
        { label: 'Recruiter' },
        { label: 'Headhunter' },
        { label: 'Silent Call Voice Clone' },
        { label: 'Internet' },
        { label: 'Travel Ticketing' },
        { label: 'Application Software' },
        { label: 'Entertainment' },
        { label: 'Government' },
        { label: 'Local Services' },
        { label: 'Automotive Industry' },
        { label: 'Car Rental' },
        { label: 'Telecommunication' }
    ];


    // --- Mapping from unknownphone.com specific terms/labels to our predefinedLabels (exact match) ---
    const manualMapping = {
        'Silent call': 'Silent Call Voice Clone',
        'Telemarketing': 'Telemarketing',
        'Debt collector': 'Debt Collection',
        'Spoofed call': 'Fraud Scam Likely',
        'Survey': 'Survey',
        'Text Message': 'Other',
        'Scam': 'Fraud Scam Likely',
        'Threats': 'Risk',
        'Prank call': 'Spam Likely',
        'Reminder': 'Other',
        'Dangerous': 'Risk',
        'Harassing': 'Spam Likely',
        'Recruitment': 'Recruiter',
        'job scam call': 'Fraud Scam Likely'
   };

    const blockKeywords = [
        'Spam', 'Scam', 'Fraud', 'Telemarketing', 'Robocall', 'Debt', 'Risk', 'Silent', 'Dangerous', 'Harassing', 'Prank', 'Threats'
    ];
    const allowKeywords = [
        'Delivery', 'Takeaway', 'Insurance', 'Customer Service', 'Bank', 'Medical', 'Charity', 'Trusted', 'Safe'
    ];


    // --- Constants, State, Logging, and Communication functions ---
    // [Modernized] Removed Iframe proxy logic.

    function log(message) { if (typeof sendMessage === 'function') sendMessage('Log', JSON.stringify(`[${PLUGIN_CONFIG.id}] ${message}`)); }
    function logError(message, error) { if (typeof sendMessage === 'function') sendMessage('Log', JSON.stringify(`[${PLUGIN_CONFIG.id}] [ERROR] ${message} ${error ? error.toString() : ''}`)); }

    function sendPluginResult(result) {
        log(`Sending final result to Flutter: ${JSON.stringify(result)}`);
        if (typeof sendMessage === 'function') {
            sendMessage('PluginResultChannel', JSON.stringify(result));
        } else if (scope.flutter_inappwebview && scope.flutter_inappwebview.callHandler) {
            scope.flutter_inappwebview.callHandler('PluginResultChannel', JSON.stringify(result));
        }
    }

    function sendPluginLoaded() {
        log('Plugin loaded, notifying Flutter.');
        if (typeof sendMessage === 'function') {
            sendMessage('TestPageChannel', JSON.stringify({ type: 'pluginLoaded', pluginId: PLUGIN_CONFIG.id, version: PLUGIN_CONFIG.version }));
        } else if (scope.flutter_inappwebview && scope.flutter_inappwebview.callHandler) {
            scope.flutter_inappwebview.callHandler('TestPageChannel', JSON.stringify({ type: 'pluginLoaded', pluginId: PLUGIN_CONFIG.id, version: PLUGIN_CONFIG.version }));
        }
    }

    /**
     * 【V1.1.0 逻辑升级】 Parses the unknownphone.com page content using Regex.
     */
    function parseHTML(html, phoneNumber) {
        const result = {
            phoneNumber: phoneNumber, sourceLabel: '', count: 0, province: '', city: '', carrier: '',
            name: '', predefinedLabel: 'Unknown', source: PLUGIN_CONFIG.name, numbers: [], success: false, error: '', action: 'none'
        };

        if (!html) return result;

        try {
            // 1. Extract Total Reports (Count)
            const countRegex = /Total\s+reports:<\/strong>\s*(\d+)/i;
            const countMatch = html.match(countRegex);
            if (countMatch) {
                result.count = parseInt(countMatch[1]);
            } else {
                const countRegexAlt = /href=["']#user_reports["'][^>]*>(\d+)/i;
                const countMatchAlt = html.match(countRegexAlt);
                if (countMatchAlt) result.count = parseInt(countMatchAlt[1]);
            }

            // 2. Extract Rating
            const ratingRegex = /Rating:<\/strong>\s*([^<]+)/i;
            const ratingMatch = html.match(ratingRegex);
            if (ratingMatch) {
                result.sourceLabel = "Rating: " + ratingMatch[1].trim();
            } else {
                const ratingRegexAlt = /Global rating:\s*([^"']+)/i;
                const ratingMatchAlt = html.match(ratingRegexAlt);
                if (ratingMatchAlt) result.sourceLabel = "Rating: " + ratingMatchAlt[1].trim();
            }

            // 3. Keyword Matching in summary
            for (const key in manualMapping) {
                const regex = new RegExp('\\b' + key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i');
                if (regex.test(html)) {
                    result.predefinedLabel = manualMapping[key];
                    if (!result.sourceLabel) result.sourceLabel = key;
                    break;
                }
            }

            // Fallback predefined label from sourceLabel
            if (result.predefinedLabel === 'Unknown' && result.sourceLabel) {
                for (const key in manualMapping) {
                    if (result.sourceLabel.toLowerCase().includes(key.toLowerCase())) {
                        result.predefinedLabel = manualMapping[key];
                        break;
                    }
                }
            }

            result.success = result.count > 0 || result.sourceLabel !== "";

            return result;
        } catch (e) {
            logError("Regex Parse Error", e);
            result.error = e.toString();
            return result;
        }
    }

     function initiateQuery(phoneNumber, requestId) {
         log(`Initiating query for '${phoneNumber}' (requestId: ${requestId})`);
         try {
             // unknownphone.com search URL structure
             const targetSearchUrl = `https://www.unknownphone.com/phone/${encodeURIComponent(phoneNumber)}`;
             const config = (scope.plugin && scope.plugin[PLUGIN_CONFIG.id] && scope.plugin[PLUGIN_CONFIG.id].config) || {};
             const userAgent = config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

             sendMessage('httpFetch', JSON.stringify({
                 url: targetSearchUrl,
                 method: 'GET',
                 headers: { 'User-Agent': userAgent },
                 pluginId: PLUGIN_CONFIG.id,
                 phoneRequestId: requestId,
                 strategy: config.strategy || 'direct'
             }));
         } catch (error) {
             logError(`Error in initiateQuery for requestId ${requestId}:`, error);
             sendPluginResult({ requestId, success: false, error: `Query initiation failed: ${error.message}` });
         }
     }


    function handleResponse(response) {
        log("handleResponse called.");
        try {
            let final = response;
            if (typeof response === 'string') {
                try { final = JSON.parse(response); } catch (e) { }
            }

            const requestId = final.requestId || final.phoneRequestId;
            if (!final.success) {
                sendPluginResult({ requestId, success: false, error: final.error || "HTTP Error" });
                return;
            }

            const html = final.responseText || "";
            const parsed = parseHTML(html, final.phoneNumber || "");

            if (parsed.success) {
                const checkStr = (parsed.sourceLabel + " " + (parsed.predefinedLabel || '')).toLowerCase();
                let determinedAction = 'none';
                if (blockKeywords.some(k => checkStr.includes(k.toLowerCase()))) {
                    determinedAction = 'block';
                } else if (allowKeywords.some(k => checkStr.includes(k.toLowerCase()))) {
                    determinedAction = 'allow';
                }
                parsed.action = determinedAction;
            }

            parsed.requestId = requestId;
            sendPluginResult(parsed);
        } catch (e) {
            logError("Error in handleResponse", e);
        }
    }

    function generateOutput(phoneNumber, nationalNumber, e164Number, requestId) {
        log(`generateOutput called for requestId: ${requestId}`);
        const numberToQuery = phoneNumber || nationalNumber || e164Number;
        if (numberToQuery) {
            // Format the number for unknownphone.com
            const formattedNumber = numberToQuery.replace(/[^0-9]/g, ''); 
            initiateQuery(formattedNumber, requestId);
        } else {
            sendPluginResult({ requestId, success: false, error: 'No valid phone number provided.' });
        }
    }

    // --- Initialization ---
    function initialize() {
        if (scope.plugin && scope.plugin[PLUGIN_CONFIG.id]) {
            log('Plugin already initialized.');
            return;
        }
        if (!scope.plugin) {
            scope.plugin = {};
        }
        scope.plugin[PLUGIN_CONFIG.id] = {
            info: PLUGIN_CONFIG,
            generateOutput: generateOutput,
            handleResponse: handleResponse,
            config: {}
        };
        log(`Plugin registered: scope.plugin.${PLUGIN_CONFIG.id}`);
        sendPluginLoaded();
    }

    initialize();

})(globalThis);
