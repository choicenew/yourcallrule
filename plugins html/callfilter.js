// [callfilter.js] - CallFilter Plugin (Pure FlutterJS Regex V6.1)
// =======================================================================================
// Architecture: Native Channel (httpFetch) + Regex Parsing
// No DOM/Iframe dependencies.
// =======================================================================================

(function (scope) {
    // --- Plugin Configuration ---
    const PLUGIN_CONFIG = {
        id: 'callfilterPlugin',
        name: 'Call Filter (Regex)',
        version: '6.1.6',
        description: 'Queries callfilter.app for phone number information using Regex.',
        config: {
            strategy: 'direct',
            successMarker: "callfilter",
        },
        settings: [
             { key: 'successMarker', label: 'Success Marker', type: 'text', hint: 'Bypass Marker', required: false }
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
        'Telemarketer': 'Telemarketing', 'Call centre': 'Customer Service', 'Financial services': 'Financial',
        'Debt collector': 'Debt Collection', 'Company': 'Other', 'Service': 'Customer Service',
        'Non-profit Organization': 'Charity', 'Survey': 'Survey', 'Nuisance call': 'Spam Likely',
        'Unsolicited call': 'Spam Likely', 'Political call': 'Political', 'Scam call': 'Fraud Scam Likely',
        'Prank call': 'Spam Likely', 'Other': 'Other', 'NEGATIVE TELEMARKETER': 'Telemarketing',
        'Unknown': 'Unknown', 'company': 'Unknown',
    };

    const blockKeywords = [
        'Spam', 'Scam', 'Fraud', 'Telemarketing', 'Robocall', 'Debt', 'Risk', 'Silent', 'Nuisance', 'Harassment',
        'Prank', 'Phishing', 'Kostenfalle', 'Unseriös', 'Betrug', 'Werbeanruf', 'Telefonterror', 'Abzocke',
        'Gewinnspiel', 'Inkasso', 'Umfrage', 'Meinungsforschung', 'Callcenter', 'Ping Anruf', 'Bandansage',
        'Gefährlich', 'Verdächtig', 'Molesto', 'Publicidad', 'Cobranza', 'Acoso', 'Estafa', 'Fraude'
    ];
    const allowKeywords = [
        'Delivery', 'Takeaway', 'Insurance', 'Customer Service', 'Bank', 'Medical', 'Charity', 'Trusted', 'Safe',
        'Confirmation', 'Zustellung', 'Versicherung', 'Spenden', 'Service', 'Termin', 'Bestellung', 'Lieferung',
        'Kundenbetreuung', 'Fiable', 'Entrega', 'Positivo'
    ];

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
        const cleanedNumber = (phoneNumber || '').replace(/\D/g, '');
        log(`Initiating Query: ${cleanedNumber || phoneNumber}`);
        const config = (scope.plugin && scope.plugin[PLUGIN_CONFIG.id] && scope.plugin[PLUGIN_CONFIG.id].config) || {};
        const successMarker = config.successMarker || "callfilter"; 
        const userAgent = config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

        const targetUrl = `https://callfilter.app/${cleanedNumber || phoneNumber}`;

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
            // 1. Label Extraction
            const labelRegex = /<span\s+style=["']color:#000["']>([\s\S]*?)<\/span>/i;
            const labelMatch = html.match(labelRegex);
            if (labelMatch) {
                const parts = labelMatch[1].replace(/<[^>]*>/g, '').trim().split(',');
                result.sourceLabel = (parts.length > 1 ? parts[1] : parts[0]).trim();
            }

            // 2. Region Extraction
            const regionRegex = /<span\s+id=["']region["']>([\s\S]*?)<\/span>/i;
            const regionMatch = html.match(regionRegex);
            if (regionMatch) {
                result.province = regionMatch[1].replace(/<[^>]*>/g, '').trim();
            }

            // 3. Count Extraction
            const countRegexLi = /<li\s+class=["']active["']>[\s\S]*?(\d+)x[\s\S]*?<\/li>/i;
            const countMatchLi = html.match(countRegexLi);
            
            if (countMatchLi) {
                result.count = parseInt(countMatchLi[1], 10);
            } else {
                 const moreInfoRegex = /id=["']moreInfo["'][\s\S]*?<strong>\d+<\/strong>[\s\S]*?<strong>(\d+)<\/strong>/i;
                 const moreInfoMatch = html.match(moreInfoRegex);
                 if (moreInfoMatch) {
                     result.count = parseInt(moreInfoMatch[1], 10);
                 }
            }

            const lowerLabel = (result.sourceLabel || '').toLowerCase();
            let matchedLabel = 'Unknown';
            for (const key in manualMapping) {
                if (lowerLabel.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerLabel)) {
                    matchedLabel = manualMapping[key];
                    break;
                }
            }
            if (matchedLabel === 'Unknown') {
                const match = predefinedLabels.find(l => lowerLabel.includes(l.label.toLowerCase()) || l.label.toLowerCase().includes(lowerLabel));
                if (match) matchedLabel = match.label;
            }
            result.predefinedLabel = matchedLabel;
            result.success = (result.sourceLabel !== "" || result.count > 0 || result.province !== "");

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
