// [variant.js] - FlutterJS Variant Template V6.0 (Pure Regex)
// =======================================================================================
// TEMPLATE DESCRIPTION:
// A variant template optimized for specific country logic (e.g. Logic based on country code).
// Environment: QuickJS (No DOM).
// Architecture: Native Channel + Regex Parsing.
// =======================================================================================

(function(scope) {
    // --- SECTION 1: Core Configuration ---
    const PLUGIN_CONFIG = {
        id: 'yourUniqueVariantPluginId',
        name: 'Variant Plugin (Regex)',
        version: '6.0.0',
        description: 'Country-aware Regex Plugin for QuickJS',
        config: {
            strategy: 'direct', // 'direct' | 'render'
        },
        settings: [
            {
                key: 'api_key',
                label: 'API Key',
                type: 'text',
                hint: 'API Key (Optional)',
                required: false
            },
            {
                key: 'successMarker',
                label: 'Success Marker',
                type: 'text',
                hint: 'e.g. search-results',
                required: false
            }
        ]
    };

    // --- SECTION 2: Mapping ---
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
    const manualMapping = { 'Scam': 'Fraud Scam Likely', 'Spam': 'Spam Likely' };
    const blockKeywords = ['Scam', 'Spam', 'Fraud', 'Telemarketing', 'Risk', 'Robocall'];
    const allowKeywords = ['Delivery', 'Courier', 'Support', 'Bank', 'Safe', 'Legit'];

    // --- SECTION 3: Helpers ---
    function log(message) { if (typeof sendMessage === 'function') sendMessage('Log', JSON.stringify(`[${PLUGIN_CONFIG.id}] ${message}`)); }
    function logError(message) { if (typeof sendMessage === 'function') sendMessage('Log', JSON.stringify(`[ERROR] ${message}`)); }
    function sendPluginResult(result) {
        if (typeof sendMessage === 'function') {
            sendMessage('PluginResultChannel', JSON.stringify(result));
        } else if (scope.flutter_inappwebview && scope.flutter_inappwebview.callHandler) {
            scope.flutter_inappwebview.callHandler('PluginResultChannel', JSON.stringify(result));
        }
    }
    function sendPluginLoaded() {
        if (typeof sendMessage === 'function') {
            sendMessage('TestPageChannel', JSON.stringify({ type: 'pluginLoaded', pluginId: PLUGIN_CONFIG.id }));
        } else if (scope.flutter_inappwebview && scope.flutter_inappwebview.callHandler) {
            scope.flutter_inappwebview.callHandler('TestPageChannel', JSON.stringify({ type: 'pluginLoaded', pluginId: PLUGIN_CONFIG.id }));
        }
    }

    // --- SECTION 4: Query Logic ---
    function initiateQuery(phoneNumber, requestId, countryCode) {
        log(`Querying: ${phoneNumber} [${countryCode}]`);

        const config = (scope.plugin && scope.plugin[PLUGIN_CONFIG.id].config) || {};
        const successMarker = config.successMarker || "wrapper";

        // Country-specific URL Logic
        const targetUrl = `https://www.example.com/${countryCode}/${encodeURIComponent(phoneNumber)}`;

        sendMessage('httpFetch', JSON.stringify({
            url: targetUrl,
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' },
            pluginId: PLUGIN_CONFIG.id,
            phoneRequestId: requestId,
            successMarker: successMarker, // ★ Bypassing Key ★
            strategy: config.strategy || 'direct'
        }));
    }

    // --- SECTION 5: Parser ---
    function parseHTML(html) {
        const result = { sourceLabel: '', count: 0, hasContent: false };
        if (!html) return result;

        // Simple Regex Example
        const match = html.match(/<title>([^<]+)<\/title>/i);
        if (match && match[1]) {
            result.sourceLabel = match[1].trim();
            result.hasContent = true;
        }
        return result;
    }

    // --- SECTION 6: Response Handler ---
    function handleResponse(response) {
        let final = response;
        if (typeof response === 'string') {
            try { final = JSON.parse(response); } catch(e) {}
        }

        const requestId = final.requestId || final.phoneRequestId;
        if (!final.success && final.status !== 200) {
             sendPluginResult({ requestId, success: false, error: final.error });
             return;
        }

        const parsed = parseHTML(final.responseText || "");
        
        // Simple logic
        const checkStr = (parsed.sourceLabel + " " + (manualMapping[parsed.sourceLabel] || 'Unknown')).toLowerCase();
        let action = 'none';
        if (blockKeywords.some(k => checkStr.includes(k.toLowerCase()))) action = 'block';
        else if (allowKeywords.some(k => checkStr.includes(k.toLowerCase()))) action = 'allow';

        sendPluginResult({
            requestId,
            success: parsed.hasContent,
            source: PLUGIN_CONFIG.name,
            sourceLabel: parsed.sourceLabel,
            predefinedLabel: 'Unknown',
            action: action
        });
    }

    // --- SECTION 7: Entry Point ---
    function generateOutput(phoneNumber, nationalNumber, e164Number, requestId) {
        if (!e164Number) {
            sendPluginResult({ requestId, success: false, error: 'e164Number required for country detection' });
            return;
        }
        
        let countryCode = 'us'; // Default
        if (e164Number.startsWith('+44')) countryCode = 'uk';
        else if (e164Number.startsWith('+1')) countryCode = 'us';

        initiateQuery(e164Number.replace(/\+/g, ''), requestId, countryCode);
    }

    // --- SECTION 8: Init ---
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
})();