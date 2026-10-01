// [cleverdialeruk.js] - Cleverdialer UK Plugin (Pure FlutterJS Regex V6.2)
// =======================================================================================
// Architecture: Native Channel (httpFetch) + Regex Parsing
// No DOM/Iframe dependencies.
// =======================================================================================

(function (scope) {
    // --- Plugin Configuration ---
    const PLUGIN_CONFIG = {
        id: 'cleverdialerukPlugin',
        name: 'Cleverdialer UK (Regex)',
        version: '6.2.1',
        description: 'Queries cleverdialer.co.uk for phone number information using Regex.',
        config: {
            strategy: 'direct',
            successMarker: "cleverdialer",
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
        'Spam': 'Spam Likely', 'Scam': 'Fraud Scam Likely', 'Fraud': 'Fraud Scam Likely', 'Nuisance': 'Spam Likely',
        'Telemarketing': 'Telemarketing', 'Debt Collection': 'Debt Collection', 'Survey': 'Survey', 'Commercial': 'Telemarketing',
        'Harassment': 'Spam Likely', 'Prank Call': 'Spam Likely', 'Robocall': 'Robocall', 'Unknown': 'Unknown',
        'Neutral': 'Unknown', 'Positive': 'Other', 'Trusted': 'Other', 'Customer Service': 'Customer Service',
        'Delivery': 'Delivery', 'Confirmation': 'Other', 'Other': 'Other',
        'Estafa': 'Fraud Scam Likely', 'Fraude': 'Fraud Scam Likely', 'Molesto': 'Spam Likely', 'Publicidad': 'Telemarketing',
        'Cobranza': 'Debt Collection', 'Encuesta': 'Survey', 'Comercial': 'Telemarketing', 'Acoso': 'Spam Likely',
        'Llamada de broma': 'Spam Likely', 'Llamada automática': 'Robocall', 'Desconocido': 'Unknown', 'Fiable': 'Other',
        'Servicio al cliente': 'Customer Service', 'Entrega': 'Delivery', 'Confirmación': 'Other', 'Otro': 'Other',
        'Spam Anruf': 'Spam Likely', 'Telefonterror': 'Spam Likely', 'Gewinnspiel': 'Spam Likely',
        'Meinungsforschung': 'Survey', 'Inkasso': 'Debt Collection', 'Unbekannt': 'Unknown',
        'Seriös': 'Other', 'Vertrauenswürdig': 'Other'
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
        log(`Initiating Query: ${phoneNumber}`);

        const config = (scope.plugin && scope.plugin[PLUGIN_CONFIG.id] && scope.plugin[PLUGIN_CONFIG.id].config) || {};
        const successMarker = config.successMarker || "cleverdialer";
        const userAgent = config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

        const targetUrl = `https://www.cleverdialer.co.uk/phonenumber/${phoneNumber}`;
        const headers = { 'User-Agent': userAgent };

        try {
            sendMessage('httpFetch', JSON.stringify({
                url: targetUrl,
                method: 'GET',
                headers: headers,
                pluginId: PLUGIN_CONFIG.id,
                phoneRequestId: requestId,
                successMarker: successMarker,
                strategy: config.strategy || 'direct'
            }));
        } catch (e) {
            logError('Query Setup Failed', e);
            sendPluginResult({ requestId, success: false, error: 'Setup Failed: ' + e.toString() });
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
            const labelRegex = /<td\s+class=["']callertype["'][^>]*>([\s\S]*?)<\/td>/i;
            const labelMatch = html.match(labelRegex);
            if (labelMatch) {
                result.sourceLabel = labelMatch[1].trim();
                const lowerLabel = result.sourceLabel.toLowerCase();
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
            }

            // 2. Star Rating Extraction
            if (!result.sourceLabel) {
                const starRegex = /class=["'][^"']*front-stars\s+stars-(\d)[^"']*["']/i;
                const starMatch = html.match(starRegex);
                if (starMatch) {
                    const score = parseInt(starMatch[1], 10);
                    result.sourceLabel = `stars-${score}`;
                    if (score <= 2) result.predefinedLabel = 'Spam Likely';
                    else if (score >= 4) result.predefinedLabel = 'Other';
                }
            }

            // 3. Count Extraction
            const countRegex = /<span\s+class=["']nowrap["'][^>]*>[\s\S]*?(\d+)[\s\S]*?(Bewertungen|ratings|valoraciones|valoración)[\s\S]*?<\/span>/i;
            const countMatch = html.match(countRegex);
            if (countMatch) {
                result.count = parseInt(countMatch[1], 10);
            } else {
                const blockedRegex = /class=["']text-blocked["'][^>]*>(\d+)/i;
                const blockedMatch = html.match(blockedRegex);
                if (blockedMatch) result.count = parseInt(blockedMatch[1], 10);
            }

            // 4. City Extraction
            const cityRegex = /class=["']list-text["']>[\s\S]*?<h4>([\s\S]*?)<\/h4>/i;
            const cityMatch = html.match(cityRegex);
            if (cityMatch) result.city = cityMatch[1].trim();

            if (result.sourceLabel || result.count > 0 || result.city) {
                result.success = true;
            }

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
        log(`Plugin registered. Version ${PLUGIN_CONFIG.version}`);
        sendPluginLoaded();
    }

    initialize();
})(globalThis);
