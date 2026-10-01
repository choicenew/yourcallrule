// [odebractelefon.js] - Odebrac Telefon Plugin (Pure FlutterJS Regex V6.0)
// =======================================================================================
// Architecture: Native Channel (httpFetch) + Regex Parsing
// No DOM/Iframe dependencies.
// =======================================================================================

(function (scope) {
    // --- Plugin Configuration ---
    const PLUGIN_CONFIG = {
        id: 'odebractelefonPlugin',
        name: 'Odebrac Telefon',
        version: '6.0.1',
        description: 'Queries odebractelefon.pl for phone number information using Regex.',
        config: {
            strategy: 'direct',
            successMarker: "odebractelefon",
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
        'NEGATYWNA TELEMARKETER': 'Telemarketing',
        'Telemarketer': 'Telemarketing',
        'Call center': 'Customer Service',
        'Ćicha rozmowa / dzwonka': 'Spam Likely',
        'Złośiwe połączenie': 'Spam Likely',
        'Niechciany telefon': 'Spam Likely',
        'Usługi finansowe': 'Financial',
        'Ściąganie długów': 'Debt Collection',
        'Organizacja non-profit': 'Charity',
        'Polityka': 'Political',
        'Oszustwo': 'Fraud Scam Likely',
        'Dowcip': 'Spam Likely',
        'Fax': 'Other',
        'SMS': 'Other',
        'Ankieta': 'Survey',
        'Firma': 'Unknown',
        'Usługa': 'Unknown',
        'Inne': 'Other',
        'Automat': 'Robocall',
        'Unknown': 'Unknown'
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
        const successMarker = config.successMarker || "odebractelefon";
        const userAgent = config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

        const targetUrl = `https://www.odebractelefon.pl/numer-telefonu/${encodeURIComponent(phoneNumber)}`;

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
            count: 0, sourceLabel: "", province: "", city: "", carrier: "",
            phoneNumber: phoneNumber, name: "unknown", action: 'none',
            predefinedLabel: 'Unknown', success: false, error: '',
            source: PLUGIN_CONFIG.name, numbers: []
        };

        if (!html) return result;

        try {
            // 1. Label and City Extraction
            const labelRegex = /class=["']number["'][^>]*>[\s\S]*?<span[^>]*style=["']color:#000["'][^>]*>([\s\S]*?)<\/span>/i;
            const labelMatch = html.match(labelRegex);
            if (labelMatch) {
                let labelText = labelMatch[1].replace(/<[^>]+>/g, '').trim();
                result.sourceLabel = labelText.replace(/^(pozytywny|negatywny|neutralny|POSITIVE|NEGATIVE|NEUTRAL)\s*/i, '').trim();
                result.success = true;
            }

            // Fallback for odebractelefon specific structure if needed
            if (!result.sourceLabel) {
                const altLabelRegex = /class=["']number["']>[\s\S]*?<span>([\s\S]*?)<\/span>/i;
                const altLabelMatch = html.match(altLabelRegex);
                if (altLabelMatch) {
                    result.sourceLabel = altLabelMatch[1].trim();
                    result.success = true;
                }
            }

            // 2. Count Extraction
            const countRegex = /class=["']infox["'][^>]*>([\s\S]*?)<\/div>/i;
            const countMatch = html.match(countRegex);
            if (countMatch) {
                const text = countMatch[1];
                if (text.includes('Single user') || text.includes('Jeden użytkownik')) {
                    result.count = 1;
                } else {
                    const allStrongs = text.match(/<strong>\s*(\d+)\s*<\/strong>/gi);
                    if (allStrongs && allStrongs.length >= 2) {
                        result.count = parseInt(allStrongs[1].replace(/<[^>]+>/g, ''));
                    } else {
                        const m = text.match(/<strong>\s*(\d+)\s*<\/strong>/i);
                        if (m) result.count = parseInt(m[1]);
                    }
                }
                if (result.count > 0) result.success = true;
            }

            // 3. City Extraction
            const cityRegex = /class=["']number["'][^>]*>[\s\S]*?<span[^>]*>([^<,]+,[^<]+)<\/span>/i;
            const cityMatch = html.match(cityRegex);
            if (cityMatch) {
                const parts = cityMatch[1].split(',');
                result.city = parts[parts.length - 1].trim();
            } else {
                // Secondary fallback for location
                const locRegex = /class=["']number["']>[\s\S]*?<span>[^<]+<\/span>[\s\u00a0]*<span>([\s\S]*?)<\/span>/i;
                const locMatch = html.match(locRegex);
                if (locMatch) result.city = locMatch[1].trim();
            }

            // 4. Mapping
            if (result.sourceLabel) {
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

            return result;
        } catch (e) {
            logError("Regex Parse Error", e);
            result.error = e.toString();
            return result;
        }
    }

    function handleResponse(response) {
        log("handleResponse called.");
        try {
            let finalResponse = response;
            if (typeof response === 'string') {
                try {
                    const decoded = decodeURIComponent(escape(atob(response)));
                    finalResponse = JSON.parse(decoded);
                } catch(e) {
                    finalResponse = JSON.parse(response);
                }
            } else if (response === "BUFFER" || (!response && scope._native_buffer)) {
                var buffer = scope._native_buffer || (scope && scope._native_buffer);
                if (buffer && typeof buffer === 'string') {
                    var decoded = decodeURIComponent(escape(atob(buffer)));
                    finalResponse = JSON.parse(decoded);
                    if (scope._native_buffer) scope._native_buffer = null;
                }
            }

            const requestId = finalResponse.requestId || finalResponse.phoneRequestId;
            if (!finalResponse.success) {
                sendPluginResult({ requestId, success: false, error: finalResponse.error || "HTTP Error" });
                return;
            }

            const html = finalResponse.responseText || "";
            const parsed = parseHTML(html, finalResponse.phoneNumber || "");
            
            if (parsed.success) {
                const label = parsed.predefinedLabel !== 'Unknown' ? parsed.predefinedLabel : parsed.sourceLabel;
                if (label) {
                    let determinedAction = 'none';
                    const checkStr = (label + " " + parsed.sourceLabel).toLowerCase();
                    for (const k of blockKeywords) { 
                        if (checkStr.includes(k.toLowerCase())) { 
                            determinedAction = 'block'; 
                            break; 
                        } 
                    }
                    if (determinedAction === 'none') {
                        for (const k of allowKeywords) { 
                            if (checkStr.includes(k.toLowerCase())) { 
                                determinedAction = 'allow'; 
                                break; 
                            } 
                        }
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