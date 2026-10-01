// [listaspam.js] - Listaspam Plugin (Pure FlutterJS Regex V6.0)
// =======================================================================================
// Architecture: Native Channel (httpFetch) + Regex Parsing
// No DOM/Iframe dependencies.
// =======================================================================================

(function (scope) {
    // --- Plugin Configuration ---
    const PLUGIN_CONFIG = {
        id: 'listaspamPlugin',
        name: 'ListaspamES',
        version: '6.0.1',
        description: 'Queries listaspam.com for phone number information using Regex.',
        config: {
            strategy: 'direct',
            successMarker: "listaspam",
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
        'Suplantación de identidad': 'Fraud Scam Likely',
        'Presunta estafa': 'Fraud Scam Likely',
        'Presuntas amenazas': 'Fraud Scam Likely',
        'Cobro de deudas': 'Debt Collection',
        'Telemarketing': 'Telemarketing',
        'Llamada de broma': 'Spam Likely',
        'Mensaje SMS': 'Spam Likely',
        'Encuesta': 'Survey',
        'Recordatorio automático': 'Robocall',
        'Llamada perdida': 'Spam Likely',
        'Sin especificar': 'Unknown',
        'Unknown' : 'Unknown',
        'Spam Call' : 'Spam Likely',
        'Beratung': 'Other',
        'Crypto Betrug': 'Fraud Scam Likely',
        'Daueranrufe': 'Spam Likely',
        'Dienstleistung': 'Customer Service',
        'Gastronomie': 'Other',
        'Geschäft': 'Other',
        'Gesundheit': 'Medical',
        'Gewinnspiel': 'Other',
        'Inkassounternehmen': 'Debt Collection',
        'Kostenfalle': 'Fraud Scam Likely',
        'Kundendienst': 'Customer Service',
        'Mailbox': 'Other',
        'Phishing': 'Fraud Scam Likely',
        'Ping Anruf': 'Spam Likely',
        'Spam': 'Spam Likely',
        'Spenden': 'Charity',
        'Support': 'Customer Service',
        'Umfrage': 'Survey',
        'Unseriös': 'Spam Likely',
        'Verkauf': 'Telemarketing',
        'Werbung': 'Telemarketing',
        'Business': 'Other',
        'Charity': 'Charity',
        'Commercial': 'Telemarketing',
        'Continuous calls': 'Spam Likely',
        'Cost trap': 'Fraud Scam Likely',
        'Counsel': 'Other',
        'Crypto fraud': 'Fraud Scam Likely',
        'Customer Service': 'Customer Service',
        'Debt collection agency': 'Debt Collection',
        'Dubious': 'Spam Likely',
        'Health': 'Medical',
        'Hospitality industry': 'Other',
        'Mailbox': 'Other',
        'Ping call': 'Spam Likely',
        'Sales': 'Telemarketing',
        'Service': 'Customer Service',
        'Support': 'Customer Service',
        'Survey': 'Survey',
        'Sweepstake': 'Other'
    };

    const blockKeywords = [
        'Suplantación', 'estafa', 'amenazas', 'Cobro de deudas', 'Telemarketing', 'Spam', 'Fraud', 'Scam', 'Phishing', 'Abzocke'
    ];
    const allowKeywords = [
        'Delivery', 'Customer Service', 'Support', 'Medical', 'Charity', 'Trusted'
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
        const successMarker = config.successMarker || "listaspam";
        const userAgent = config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

        const targetUrl = `https://www.listaspam.com/busca.php?Telefono=${encodeURIComponent(phoneNumber)}`;

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
            // 1. Label and Count Extraction
            const labelOrder = [
                'Suplantación de identidad', 'Presunta estafa', 'Presuntas amenazas', 'Cobro de deudas',
                'Telemarketing', 'Llamada de broma', 'Mensaje SMS', 'Encuesta',
                'Recordatorio automático', 'Llamada perdida', 'Sin especificar'
            ];

            for (const labelText of labelOrder) {
                const regex = new RegExp(`<strong>\\s*${labelText}\\s*</strong>\\s*\\((\\d+)\\s*veces\\)`, 'i');
                const match = html.match(regex);
                if (match) {
                    result.sourceLabel = labelText;
                    result.count = parseInt(match[1], 10) || 0;
                    break;
                }
            }

            // 2. Fallback Label/Count
            if (!result.sourceLabel) {
                 const ratingRegex = /class=["'][^"']*phone_rating\s+result-(\d)[^"']*["']/i;
                 const ratingMatch = html.match(ratingRegex);
                 if (ratingMatch) {
                     const score = parseInt(ratingMatch[1], 10);
                     if (score <= 2) result.sourceLabel = "Spam Call";
                     else if (score === 3) result.sourceLabel = "Unknown";
                     else result.sourceLabel = "Other";

                     const countRegex = /class=["']n_reports["'][\s\S]*?class=["']result["'][\s\S]*?<a>(\d+)<\/a>/i;
                     const countMatch = html.match(countRegex);
                     if (countMatch) result.count = parseInt(countMatch[1], 10);
                 }
            }

            // 3. City Extraction
            const cityRegex = /class=["']data_location["'][\s\S]*?<span>([\s\S]*?)<\/span>/i;
            const cityMatch = html.match(cityRegex);
            if (cityMatch) {
                result.city = cityMatch[1].split('-')[0].trim();
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
            result.success = (result.sourceLabel !== "" || result.count > 0);

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