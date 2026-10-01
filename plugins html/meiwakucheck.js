// [meiwakucheck.js] - Meiwaku Check Plugin (Pure FlutterJS Regex V6.0)
// =======================================================================================
// Architecture: Native Channel (httpFetch) + Regex Parsing
// No DOM/Iframe dependencies.
// =======================================================================================

(function (scope) {
    // --- Plugin Configuration ---
    const PLUGIN_CONFIG = {
        id: 'meiwakucheckPlugin',
        name: 'Meiwaku Check',
        version: '6.0.1',
        description: 'Queries meiwakucheck.com for phone number information using Regex.',
        config: {
            strategy: 'direct',
            successMarker: "meiwakucheck",
        },
        settings: [
            {
                key: 'successMarker',
                label: 'Success Marker',
                type: 'text',
                hint: '过盾标识',
                required: false
            }
        ]
    };

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

    const manualMapping = {
        '勧誘/営業/案内': 'Telemarketing',
        '詐欺 / 犯罪の匂い': 'Fraud Scam Likely',
        'その他の迷惑': 'Spam Likely',
        '不明': 'Unknown',
        '安全 / (迷惑ではない)': 'Other',
    };

    const blockKeywords = ['勧誘', '営業', '案内', '詐欺', '犯罪', '迷惑', 'Telemarketing', 'Fraud', 'Spam'];
    const allowKeywords = ['安全', 'Delivery', 'Trusted', 'Safe'];

    // --- Helpers ---
    function log(message) { if (typeof sendMessage === 'function') sendMessage('Log', JSON.stringify(`[${PLUGIN_CONFIG.id}] ${message}`)); }
    function logError(message, error) { if (typeof sendMessage === 'function') sendMessage('Log', JSON.stringify(`[${PLUGIN_CONFIG.id}] [ERROR] ${message} ${error ? error.toString() : ''}`)); }

    function sendPluginResult(result) {
        if (typeof sendMessage === 'function') {
            sendMessage('PluginResultChannel', JSON.stringify(result));
        } else if (scope.flutter_inappwebview && scope.flutter_inappwebview.callHandler) {
            scope.flutter_inappwebview.callHandler('PluginResultChannel', JSON.stringify(result));
        }
    }

    function sendPluginLoaded() {
        if (typeof sendMessage === 'function') {
            sendMessage('TestPageChannel', JSON.stringify({ type: 'pluginLoaded', pluginId: PLUGIN_CONFIG.id, version: PLUGIN_CONFIG.version }));
        } else if (scope.flutter_inappwebview && scope.flutter_inappwebview.callHandler) {
            scope.flutter_inappwebview.callHandler('TestPageChannel', JSON.stringify({ type: 'pluginLoaded', pluginId: PLUGIN_CONFIG.id, version: PLUGIN_CONFIG.version }));
        }
    }

    // --- Core Logic ---
    function initiateQuery(phoneNumber, requestId) {
        log(`Initiating Query: ${phoneNumber}`);
        const config = (scope.plugin && scope.plugin[PLUGIN_CONFIG.id] && scope.plugin[PLUGIN_CONFIG.id].config) || {};
        const successMarker = config.successMarker || "meiwakucheck";
        const userAgent = config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

        const targetUrl = `https://meiwakucheck.com/search?tel_no=${encodeURIComponent(phoneNumber)}`;

        try {
            sendMessage('httpFetch', JSON.stringify({
                url: targetUrl,
                method: 'GET',
                headers: { 'User-Agent': userAgent },
                pluginId: PLUGIN_CONFIG.id,
                phoneRequestId: requestId,
                successMarker: successMarker,
                strategy: config.strategy || 'direct'
            }));
        } catch (e) {
            logError("Query Setup Failed", e);
            sendPluginResult({ requestId, success: false, error: e.message });
        }
    }

    function parseHTML(html, phoneNumber) {
        const result = {
            phoneNumber: phoneNumber, sourceLabel: '', count: 0, province: '', city: '', carrier: '',
            name: '', predefinedLabel: '', source: PLUGIN_CONFIG.name, numbers: [], success: false, error: '', action: 'none'
        };

        if (!html) return result;

        try {
            // 1. Name Extraction
            const nameRegex = /(?:利用事業者|Registered business)[\s\S]*?<td>([\s\S]*?)(?:\[▼詳細を見る\]|<\/td>)/i;
            const nameMatch = html.match(nameRegex);
            if (nameMatch) {
                let nameText = nameMatch[1].replace(/<[^>]*>/g, '').trim();
                result.name = (nameText === '？' || nameText === 'Unknown') ? 'Unknown' : (nameText === '---' ? '' : nameText);
            }

            // 2. Count Extraction
            const countRegex = /(?:アクセス回数|Number of access|Access count)[\s\S]*?<td>[\s\S]*?<strong>(\d+)<\/strong>/i;
            const countMatch = html.match(countRegex);
            if (countMatch) {
                result.count = parseInt(countMatch[1], 10) || 0;
            }

            // 3. Label Extraction
            const labelRegex = /(?:<i\s+class=["']icon-comment["'][^>]*>[\s\S]*?<u>\s*<b>([\s\S]*?)<\/b>|<span>([\s\S]*?)<\/span>)/i;
            const labelMatch = html.match(labelRegex);
            if (labelMatch) {
                result.sourceLabel = (labelMatch[1] || labelMatch[2] || '').trim();
            }

            // 4. Location Extraction
            const locationRegex = /(?:所在地|Location|address)[\s\S]*?<td>([\s\S]*?)<\/td>/i;
            const locationMatch = html.match(locationRegex);
            if (locationMatch && !locationMatch[1].includes('---')) {
                const loc = locationMatch[1].replace(/<[^>]*>/g, '').trim();
                result.province = loc;
                result.city = loc;
            }

            const cleanStr = (s) => (s || '').replace(/[\u00a0\s]+/g, ' ').trim().toLowerCase();
            const lowerLabel = cleanStr(result.sourceLabel);
            let matchedLabel = 'Unknown';
            for (const key in manualMapping) {
                if (cleanStr(key) === lowerLabel) {
                    matchedLabel = manualMapping[key];
                    break;
                }
            }
            if (matchedLabel === 'Unknown') {
                const match = predefinedLabels.find(l => cleanStr(l.label) === lowerLabel);
                if (match) matchedLabel = match.label;
            }
            result.predefinedLabel = matchedLabel;
            result.success = (result.name !== "" || result.sourceLabel !== "" || result.count > 0);

            return result;
        } catch (e) {
            logError("Regex Parse Error", e);
            result.error = e.message;
            return result;
        }
    }

    function handleResponse(response) {
        log("handleResponse called.");
        try {
            let final = response;
            if (typeof response === 'string') {
                try { final = JSON.parse(response); } catch(e) {}
            }

            const requestId = final.requestId || final.phoneRequestId;
            if (!final.success) {
                sendPluginResult({ requestId, success: false, error: final.error || "HTTP Error" });
                return;
            }

            const html = final.responseText || "";
            const parsed = parseHTML(html, final.phoneNumber || "");

            if (parsed.success) {
                 const label = parsed.predefinedLabel || parsed.sourceLabel;
                 if (label) {
                     let determinedAction = 'none';
                     const lowLabel = label.toLowerCase();
                     for (const k of blockKeywords) { if (lowLabel.includes(k.toLowerCase())) { determinedAction = 'block'; break; } }
                     if (determinedAction === 'none') {
                         for (const k of allowKeywords) { if (lowLabel.includes(k.toLowerCase())) { determinedAction = 'allow'; break; } }
                     }
                     parsed.action = determinedAction;
                 }
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
            initiateQuery(numberToQuery, requestId);
        } else {
            sendPluginResult({ requestId, success: false, error: "No Number" });
        }
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