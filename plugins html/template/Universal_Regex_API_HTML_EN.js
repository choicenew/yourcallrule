// [Universal_Regex_API_HTML_EN.js] - FlutterJS Universal HTML Regex Template V6.1.2
// =======================================================================================
// TEMPLATE DESCRIPTION:
// Universal Template for HTML Scraping via Regex in QuickJS.
// Uses Native Channel for HTTP requests.
// =======================================================================================

(function(scope) {
    const PLUGIN_CONFIG = {
        id: 'universalRegexHtmlEn',
        name: 'Universal HTML Regex (EN)',
        version: '6.1.2',
        description: 'Universal Regex Plugin using Native Channel',
        // --- strategy specification ---
        // 'direct' (default): Native HTTP / Regex extraction mode (SSR). 200 OK passes straight to JS regex. Unmarked numbers return No Match directly, NEVER triggering headless WebView.
        // 'render': Headless WebView dynamic rendering mode (SPA). Used for AJAX sites like Baidu or Cloudflare challenge pages.
        config: {
            strategy: 'direct', // 'direct' | 'render'
        },
        settings: [
            {
                key: 'target_url',
                label: 'URL Template',
                type: 'text',
                hint: 'https://ex.com/s/{num}',
                required: true
            },
            {
                key: 'label_regex',
                label: 'Regex (Group 1)',
                type: 'text',
                hint: 'class="tag">([^<]+)<',
                required: true
            },
            {
                key: 'successMarker',
                label: 'Success Marker',
                type: 'text',
                hint: 'Bypass Marker',
                required: false
            }
        ]
    };

    const predefinedLabels = [
        { 'label': 'Fraud Scam Likely' }, { 'label': 'Spam Likely' }, { 'label': 'Telemarketing' },
        { 'label': 'Robocall' }, { 'label': 'Delivery' }, { 'label': 'Takeaway' },
        { 'label': 'Ridesharing' }, { 'label': 'Insurance' }, { 'label': 'Loan' },
        { 'label': 'Customer Service' }, { 'label': 'Unknown' }, { 'label': 'Financial' },
        { 'label': 'Bank' }, { 'label': 'Education' }, { 'label': 'Medical' },
        { 'label': 'Charity' }, { 'label': 'Other' }, { 'label': 'Debt Collection' },
        { 'label': 'Survey' }, { 'label': 'Political' }, { 'label': 'Ecommerce' },
        { 'label': 'Risk' }, { 'label': 'Agent' }, { 'label': 'Recruiter' },
        { 'label': 'Headhunter' }, { 'label': 'Silent Call Voice Clone' }, { 'label': 'Internet' },
        { 'label': 'Travel Ticketing' }, { 'label': 'Application Software' }, { 'label': 'Entertainment' },
        { 'label': 'Government' }, { 'label': 'Local Services' }, { 'label': 'Automotive Industry' },
        { 'label': 'Car Rental' }, { 'label': 'Telecommunication' },
    ];

    const manualMapping = { 'scam': 'Fraud Scam Likely' };
    const blockKeywords = ['Scam', 'Fraud', 'Spam', 'Telemarketing', 'Risk', 'Robocall'];
    const allowKeywords = ['Delivery', 'Courier', 'Support', 'Bank', 'Safe', 'Legit'];

    function log(msg) { if (typeof sendMessage === 'function') sendMessage('Log', JSON.stringify(`[${PLUGIN_CONFIG.id}] ${msg}`)); }
    function logError(msg) { if (typeof sendMessage === 'function') sendMessage('Log', JSON.stringify(`[${PLUGIN_CONFIG.id}] [ERROR] ${msg}`)); }
    function sendPluginResult(res) {
        if (typeof sendMessage === 'function') {
            sendMessage('PluginResultChannel', JSON.stringify(res));
        } else if (scope.flutter_inappwebview && scope.flutter_inappwebview.callHandler) {
            scope.flutter_inappwebview.callHandler('PluginResultChannel', JSON.stringify(res));
        }
    }
    function sendPluginLoaded() {
        if (typeof sendMessage === 'function') {
            sendMessage('TestPageChannel', JSON.stringify({ type: 'pluginLoaded', pluginId: PLUGIN_CONFIG.id }));
        } else if (scope.flutter_inappwebview && scope.flutter_inappwebview.callHandler) {
            scope.flutter_inappwebview.callHandler('TestPageChannel', JSON.stringify({ type: 'pluginLoaded', pluginId: PLUGIN_CONFIG.id }));
        }
    }

    function initiateQuery(phoneNumber, requestId) {
        const config = (scope.plugin && scope.plugin[PLUGIN_CONFIG.id].config) || {};
        const urlTemplate = config.target_url;
        const successMarker = config.successMarker;

        if (!urlTemplate) {
            sendPluginResult({ requestId, success: false, error: "No URL Template" });
            return;
        }

        const targetUrl = urlTemplate.replace('{num}', encodeURIComponent(phoneNumber));

        sendMessage('httpFetch', JSON.stringify({
            url: targetUrl,
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' },
            pluginId: PLUGIN_CONFIG.id,
            phoneRequestId: requestId,
            successMarker: successMarker,
            strategy: config.strategy || 'direct'
        }));
    }

    function handleResponse(response) {
        let final = response;
        if (typeof response === 'string') {
            try { final = JSON.parse(response); } catch(e) {}
        }
        
        const requestId = final.requestId || final.phoneRequestId;

        if (!final.success) {
            sendPluginResult({ requestId, success: false, error: final.error });
            return;
        }

        const html = final.responseText || "";
        const config = (scope.plugin && scope.plugin[PLUGIN_CONFIG.id].config) || {};
        const regexStr = config.label_regex;

        let sourceLabel = "No Match";
        let hasContent = false;

        if (regexStr) {
            try {
                const regex = new RegExp(regexStr, 'i');
                const match = html.match(regex);
                if (match) {
                    sourceLabel = (match[1] || match[0]).trim();
                    hasContent = true;
                }
            } catch(e) {}
        }

        const cleanStr = (s) => (s || '').replace(/[\u00a0\s]+/g, ' ').trim().toLowerCase();
        const lowerLabel = cleanStr(sourceLabel);
        let predefinedLabel = 'Unknown';
        for (const key in manualMapping) {
            if (cleanStr(key) === lowerLabel) {
                predefinedLabel = manualMapping[key];
                break;
            }
        }
        if (predefinedLabel === 'Unknown') {
            const match = predefinedLabels.find(l => cleanStr(l.label) === lowerLabel);
            if (match) predefinedLabel = match.label;
        }

        const checkStr = (sourceLabel + " " + predefinedLabel).toLowerCase();
        let action = 'none';
        if (blockKeywords.some(k => checkStr.includes(k.toLowerCase()))) action = 'block';
        else if (allowKeywords.some(k => checkStr.includes(k.toLowerCase()))) action = 'allow';

        sendPluginResult({
            requestId,
            success: hasContent,
            source: PLUGIN_CONFIG.name,
            sourceLabel: sourceLabel || "No Match",
            predefinedLabel: predefinedLabel,
            action: action
        });
    }

    function generateOutput(phone, national, e164, reqId) {
        if (phone) initiateQuery(phone, reqId);
        else sendPluginResult({ requestId: reqId, success: false, error: "No Number" });
    }

    function initialize() {
        if (!scope.plugin) scope.plugin = {};
        scope.plugin[PLUGIN_CONFIG.id] = {
            info: PLUGIN_CONFIG,
            generateOutput: generateOutput,
            handleResponse: handleResponse,
            config: {}
        };
        sendPluginLoaded();
    }
    initialize();
})(globalThis);
