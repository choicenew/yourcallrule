// [English_API.js] - FlutterJS Universal API Plugin Template V6.0 (Native Channel)
// =======================================================================================
// TEMPLATE DESCRIPTION:
// Standard API Plugin for English services using Native Channel (httpFetch).
// Core Logic:
// 1. Request: sendMessage('httpFetch')
// 2. Response: handleResponse (Async Callback)
// 3. Parsing: JSON.parse
// =======================================================================================

(function(scope) {
    // --- SECTION 1: Config ---
    const PLUGIN_CONFIG = {
        id: 'yourApiPluginIdEn',
        name: 'API Plugin Template (EN)',
        version: '6.0.0',
        description: 'Standard API Plugin using Native Channel',
        config: {
            strategy: 'direct', // 'direct' | 'render'
        },
        settings: [
            {
                key: 'api_key',
                label: 'API Key',
                type: 'text',
                hint: 'Enter your API Key',
                required: true
            },
            {
                key: 'successMarker',
                label: 'Success Marker',
                type: 'text',
                hint: 'Optional Bypass Marker',
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
    function log(msg) { if (typeof sendMessage === 'function') sendMessage('Log', JSON.stringify(`[${PLUGIN_CONFIG.id}] ${msg}`)); }
    function sendPluginLoaded() {
        if (typeof sendMessage === 'function') {
            sendMessage('TestPageChannel', JSON.stringify({ type: 'pluginLoaded', pluginId: PLUGIN_CONFIG.id }));
        } else if (scope.flutter_inappwebview && scope.flutter_inappwebview.callHandler) {
            scope.flutter_inappwebview.callHandler('TestPageChannel', JSON.stringify({ type: 'pluginLoaded', pluginId: PLUGIN_CONFIG.id }));
        }
    }
    function sendPluginResult(res) {
        if (typeof sendMessage === 'function') {
            sendMessage('PluginResultChannel', JSON.stringify(res));
        } else if (scope.flutter_inappwebview && scope.flutter_inappwebview.callHandler) {
            scope.flutter_inappwebview.callHandler('PluginResultChannel', JSON.stringify(res));
        }
    }

    // --- SECTION 4: Request ---
    function initiateQuery(phoneNumber, requestId) {
        log(`Querying API: ${phoneNumber}`);
        
        const config = (scope.plugin && scope.plugin[PLUGIN_CONFIG.id].config) || {};
        const apiKey = config.api_key;
        const successMarker = config.successMarker;

        if (!apiKey) {
            sendPluginResult({ requestId, success: false, error: "Missing API Key" });
            return;
        }

        const url = "https://api.unknown.com/lookup";
        const body = JSON.stringify({ number: phoneNumber });

        sendMessage('httpFetch', JSON.stringify({
            url: url,
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json' 
            },
            body: body,
            pluginId: PLUGIN_CONFIG.id,
            phoneRequestId: requestId,
            successMarker: successMarker,
            strategy: config.strategy || 'direct'
        }));
    }

    // --- SECTION 5: Response ---
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

        try {
            const data = JSON.parse(final.responseText);
            const label = data.label || "Unknown";
            const checkStr = (label + " " + (manualMapping[label] || 'Unknown')).toLowerCase();
            let action = 'none';
            if (blockKeywords.some(k => checkStr.includes(k.toLowerCase()))) action = 'block';
            else if (allowKeywords.some(k => checkStr.includes(k.toLowerCase()))) action = 'allow';

            sendPluginResult({
                requestId,
                success: true,
                source: PLUGIN_CONFIG.name,
                sourceLabel: label,
                predefinedLabel: manualMapping[label] || 'Unknown',
                action: action,
                count: data.reports || 0
            });
        } catch(e) {
            sendPluginResult({ requestId, success: false, error: "Parse Error: " + e.message });
        }
    }

    // --- SECTION 6: Init ---
    function generateOutput(phone, national, e164, reqId) {
        if (phone) initiateQuery(phone, reqId);
        else sendPluginResult({ requestId: reqId, success: false, error: "No number" });
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
