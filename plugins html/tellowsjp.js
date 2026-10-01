// tellowsjp.js - Tellows Japan Plugin (Pure FlutterJS Regex V5.6.0)
(function (scope) {
    // --- Plugin Configuration ---
    const PLUGIN_CONFIG = {
        id: 'tellowsjpPlugin',
        name: 'TellowsJP',
        version: '5.6.0',
        description: 'Queries www.tellows.jp for phone number information using Regex.',
        config: { strategy: 'direct', successMarker: "tellows" },
    };

    const predefinedLabels = [
        { label: 'Fraud Scam Likely' }, { label: 'Spam Likely' }, { label: 'Telemarketing' },
        { label: 'Robocall' }, { label: 'Delivery' }, { label: 'Takeaway' },
        { label: 'Ridesharing' }, { label: 'Insurance' }, { label: 'Loan' },
        { label: 'Customer Service' }, { label: 'Unknown' }, { label: 'Financial' },
        { label: 'Bank' }, { label: 'Education' }, { label: 'Medical' },
        { label: 'Charity' }, { label: 'Other' }, { label: 'Debt Collection' },
        { label: 'Survey' }, { label: 'Political' }, { label: 'Ecommerce' },
        { label: 'Risk' }, { label: 'Agent' }, { label: 'Recruiter' },
        { label: 'Headhunter' }, { label: 'Silent Call Voice Clone' }, { label: 'Internet' },
        { label: 'Travel Ticketing' }, { label: 'Application Software' }, { label: 'Entertainment' },
        { label: 'Government' }, { label: 'Local Services' }, { label: 'Automotive Industry' },
        { label: 'Car Rental' }, { label: 'Telecommunication' }
    ];

    const manualMapping = {
        'Unknown': 'Unknown', 'Trustworthy number': 'Other', 'Sweepstakes, lottery': 'Spam Likely',
        'Debt collection company': 'Debt Collection', 'Aggressive advertising': 'Telemarketing',
        'Survey': 'Survey', 'Harassment calls': 'Spam Likely', 'Cost trap': 'Fraud Scam Likely',
        'Telemarketer': 'Telemarketing', 'Ping Call': 'Spam Likely', 'SMS spam': 'Spam Likely',
        'Spam Call': 'Spam Likely', 'Phishing': 'Fraud Scam Likely'
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

    function parseHTML(html, phoneNumber) {
        const result = {
            count: 0, sourceLabel: "", province: "", city: "", carrier: "",
            phoneNumber: phoneNumber, name: "unknown", action: 'none',
            predefinedLabel: 'Unknown', success: false, error: '',
            source: PLUGIN_CONFIG.name, numbers: []
        };
        if (!html) return result;

        try {
            const labelRe = /Types of call:<\/a><\/b>[\s\S]*?(?:<[^>]+>)*\s*([\s\S]*?)(?:<|\r|\n)/i;
            const labelMatch = html.match(labelRe);
            if (labelMatch) {
                result.sourceLabel = labelMatch[1].trim();
                result.success = true;
            }

            if (!result.sourceLabel) {
                const scoreImgRe = /a href=["'][^"']*tellows_score[^"']*["'][\s\S]*?alt=["']Scores ([789])/i;
                if (html.match(scoreImgRe)) {
                    result.sourceLabel = "Spam Call";
                    result.success = true;
                }
            }

            const nameRe = /class=["']callerId["'][^>]*>([\s\S]*?)<\/span>/i;
            const nm = html.match(nameRe);
            if (nm) {
                result.name = nm[1].trim();
                result.success = true;
            }

            const cityRe = /City:<\/strong>[\s\S]*?\">\s*([\s\S]*?)\s*(?:<\/a>|-|<)/i;
            const ct = html.match(cityRe);
            if (ct) result.city = ct[1].trim();

            const countRe = /Ratings:<\/strong>\s*<span[^>]*>(\d+)<\/span>/i;
            const cnt = html.match(countRe);
            if (cnt) {
                result.count = parseInt(cnt[1], 10);
                if (result.count > 0) result.success = true;
            }

            for (const key in manualMapping) {
                if (html.indexOf(key) !== -1) {
                    if (!result.sourceLabel) result.sourceLabel = key;
                    result.predefinedLabel = manualMapping[key];
                    result.success = true;
                    break;
                }
            }

            if (result.sourceLabel && result.predefinedLabel === 'Unknown') {
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
            }

            return result;
        } catch (e) {
            logError("Regex Parse Error", e);
            result.error = e.toString();
            return result;
        }
    }

    function handleResponse(response) {
        try {
            let final = response;
            if (typeof response === 'string') { try { final = JSON.parse(response); } catch (e) { } }
            const requestId = final.requestId || final.phoneRequestId;
            if (!final.success) { sendPluginResult({ requestId, success: false, error: final.error || "HTTP Error" }); return; }
            const html = final.responseText || "";
            const parsed = parseHTML(html, final.phoneNumber || "");
            parsed.requestId = requestId;
            if (parsed.success) {
                const label = parsed.predefinedLabel || parsed.sourceLabel;
                if (label) {
                    let determinedAction = 'none';
                    const lowLabel = label.toLowerCase();
                    for (const k of blockKeywords) { if (lowLabel.includes(k.toLowerCase())) { determinedAction = 'block'; break; } }
                    if (determinedAction === 'none') { for (const k of allowKeywords) { if (lowLabel.includes(k.toLowerCase())) { determinedAction = 'allow'; break; } } }
                    parsed.action = determinedAction;
                }
            }
            sendPluginResult(parsed);
        } catch (e) { logError("Error in handleResponse", e); }
    }

    function generateOutput(phoneNumber, nationalNumber, e164Number, requestId) {
        const numberToQuery = phoneNumber || nationalNumber || e164Number;
        if (!numberToQuery) { sendPluginResult({ requestId, success: false, error: 'No Number' }); return; }
        const targetSearchUrl = `https://www.tellows.jp/num/${encodeURIComponent(numberToQuery)}?lang=en`;
        const config = (scope.plugin && scope.plugin[PLUGIN_CONFIG.id] && scope.plugin[PLUGIN_CONFIG.id].config) || {};
        const successMarker = config.successMarker || "tellows";
        const userAgent = config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

        sendMessage('httpFetch', JSON.stringify({
            url: targetSearchUrl, method: 'GET', headers: { 'User-Agent': userAgent },
            pluginId: PLUGIN_CONFIG.id, phoneRequestId: requestId, successMarker: successMarker,
            strategy: config.strategy || 'direct'
        }));
    }

    function initialize() {
        if (!scope.plugin) scope.plugin = {};
        scope.plugin[PLUGIN_CONFIG.id] = { info: PLUGIN_CONFIG, generateOutput: generateOutput, handleResponse: handleResponse, config: {} };
        sendPluginLoaded();
    }
    initialize();
})(globalThis);