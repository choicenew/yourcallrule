// [slicklyES.js] - Slick.ly ES Plugin (Pure FlutterJS Regex V6.2)
// =======================================================================================
// Architecture: Native Channel (httpFetch) + Regex Parsing
// No DOM/Iframe dependencies.
// =======================================================================================

(function (scope) {
    // --- Plugin Configuration ---
    const PLUGIN_CONFIG = {
        id: 'slicklyEsPhoneNumberPlugin',
        name: 'Slick.ly ES (Regex)',
        version: '6.2.1',
        description: 'Queries Slick.ly (ES/LATAM) for phone number information using Regex.',
        config: {
            strategy: 'direct',
            successMarker: "slickly",
        },
        settings: [
            { key: 'successMarker', label: 'Success Marker', type: 'text', hint: '过盾标识', required: false }
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
        'Peligroso': 'Risk', 'Dangerous': 'Risk',
        'Sospechoso': 'Spam Likely', 'Suspicious': 'Spam Likely',
        'Estafa': 'Fraud Scam Likely', 'Fraude': 'Fraud Scam Likely',
        'Engaño': 'Fraud Scam Likely', 'Datos falsos': 'Fraud Scam Likely',
        'Información falsa': 'Fraud Scam Likely', 'Spam': 'Spam Likely',
        'Molestia': 'Spam Likely', 'Telemarketing': 'Telemarketing',
        'Llamada automática': 'Robocall', 'Entrega': 'Delivery',
        'Comida para llevar': 'Takeaway', 'Viaje compartido': 'Ridesharing',
        'Seguro': 'Insurance', 'Préstamo': 'Loan',
        'Servicio al cliente': 'Customer Service', 'Desconocido': 'Unknown',
        'Financiero': 'Financial', 'Banco': 'Bank', 'Educación': 'Education',
        'Médico': 'Medical', 'Caridad': 'Charity', 'Otros': 'Other',
        'Cobro de deudas': 'Debt Collection', 'Encuesta': 'Survey',
        'Político': 'Political', 'Comercio electrónico': 'Ecommerce',
        'Riesgo': 'Risk', 'Agente': 'Agent', 'Reclutador': 'Recruiter',
        'Cazatalentos': 'Headhunter', 'Llamada silenciosa': 'Silent Call Voice Clone',
        'Clon de voz': 'Silent Call Voice Clone', 'Internet': 'Internet',
        'Viajes y boletos': 'Travel Ticketing', 'Software de aplicación': 'Application Software',
        'Entretenimiento': 'Entertainment', 'Gobierno': 'Government',
        'Servicios locales': 'Local Services', 'Industria automotriz': 'Automotive Industry',
        'Alquiler de coches': 'Car Rental', 'Telecomunicaciones': 'Telecommunication',
        'SCAM': 'Fraud Scam Likely', 'Swindle': 'Fraud Scam Likely',
        'Offer': 'Telemarketing', 'Deception': 'Fraud Scam Likely',
        'Scammer': 'Fraud Scam Likely', 'Provides false information': 'Fraud Scam Likely',
        'Estafadores': 'Fraud Scam Likely', 'Llamadas y cortan': 'Spam Likely',
        'Mismo cuento': 'Fraud Scam Likely', 'Envío código no solicitado': 'Fraud Scam Likely',
        'Hackear cuentas': 'Fraud Scam Likely', 'Ganado un premio': 'Fraud Scam Likely',
        'Ofreciendo productos': 'Telemarketing', 'Venta al por mayor': 'Other',
        'Extorsión': 'Risk', 'Extorsionador': 'Risk', 'Acosador': 'Risk'
    };

    const blockKeywords = [
        'Estafa', 'Fraude', 'Sospechoso', 'Engaño', 'Datos falsos', 'Información falsa',
        'Spam', 'Molestia', 'Telemarketing', 'Llamada automática',
        'Préstamo', 'Riesgo', 'Estafadores', 'Mismo cuento', 'Envío código no solicitado',
        'Hackear cuentas', 'Extorsión', 'Extorsionador', 'Acosador', 'Peligroso'
    ];
    const allowKeywords = [
        'Entrega', 'Comida para llevar', 'Viaje compartido', 'Seguro',
        'Servicio al cliente', 'Desconocido', 'Financiero', 'Banco', 'Educación',
        'Médico', 'Caridad', 'Venta al por mayor', 'Seguro'
    ];

    const countryCodeMap = {
        '51': 'pe', '52': 'mx', '54': 'ar', '58': 've', '57': 'co', '56': 'cl', '34': 'es'
    };

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
    function initiateQuery(phoneNumber, requestId, countryCode) {
        log(`Initiating Query: ${phoneNumber} for ${countryCode}`);
        const config = (scope.plugin && scope.plugin[PLUGIN_CONFIG.id] && scope.plugin[PLUGIN_CONFIG.id].config) || {};
        const successMarker = config.successMarker || "slickly";
        const userAgent = config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

        const targetUrl = `https://slick.ly/${countryCode.toLowerCase()}/${phoneNumber}`;

        try {
            sendMessage('httpFetch', JSON.stringify({
                url: targetUrl,
                method: 'GET',
                headers: { 'User-Agent': userAgent },
                pluginId: PLUGIN_CONFIG.id,
                phoneRequestId: requestId,
                successMarker: successMarker
            }));
        } catch (e) {
            logError("Query Setup Failed", e);
            sendPluginResult({ requestId, success: false, error: e.message });
        }
    }

    function parseHTML(html, phoneNumber) {
        const result = {
            summaryLabel: '', keywordsText: '', count: 0, commentsText: '',
            negVotes: 0, posVotes: 0
        };

        if (!html) return result;

        try {
            // 1. Extract Summary
            const summaryRegex = /<span class=["']summary-result[^"']*["']>([^<]+)<\/span>/i;
            const summaryMatch = html.match(summaryRegex);
            if (summaryMatch) result.summaryLabel = summaryMatch[1].trim();

            // 2. Extract Keywords
            const keywordsRegex = /<div class=["']keywords["']>[\s\S]*?<span>([^<]+)<\/span>/i;
            const keywordsMatch = html.match(keywordsRegex);
            if (keywordsMatch) result.keywordsText = keywordsMatch[1].trim();

            // 3. Extract Count
            const countRegex = /(?:註釋|注释|Comments)\s*\((\d+)\)/i;
            const countMatch = html.match(countRegex);
            if (countMatch) result.count = parseInt(countMatch[1], 10);

            // 4. Extract Votes
            const negRegex = /<span class=["']negative-count["']>\s*(\d+)\s*<\/span>/i;
            const posRegex = /<span class=["']positive-count["']>\s*(\d+)\s*<\/span>/i;
            const negMatch = html.match(negRegex);
            const posMatch = html.match(posRegex);
            if (negMatch) result.negVotes = parseInt(negMatch[1], 10);
            if (posMatch) result.posVotes = parseInt(posMatch[1], 10);

            // 5. Extract Comments
            const commentContentRegex = /<div class=["']content["']>\s*<p>([\s\S]*?)<\/p>/gi;
            let commentMatch;
            let commentsList = [];
            while ((commentMatch = commentContentRegex.exec(html)) !== null) {
                if (commentMatch[1]) commentsList.push(commentMatch[1].trim());
            }
            result.commentsText = commentsList.join(' ');

            return result;
        } catch (e) {
            logError("Regex Parse Error", e);
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
            
            let sourceLabel = parsed.keywordsText || parsed.summaryLabel || '';
            let predefinedLabel = 'Unknown';
            let action = 'none';

            const mappingSourceString = `${parsed.keywordsText} ${parsed.summaryLabel} ${parsed.commentsText}`;
            for (let key in manualMapping) {
                if (mappingSourceString.includes(key)) {
                    predefinedLabel = manualMapping[key];
                    break;
                }
            }

            const checkStr = (sourceLabel + " " + predefinedLabel + " " + mappingSourceString).toLowerCase();
            if (blockKeywords.some(k => checkStr.includes(k.toLowerCase()))) {
                action = 'block';
            } else if (allowKeywords.some(k => checkStr.includes(k.toLowerCase()))) {
                action = 'allow';
            }

            if (action === 'none') {
                if (['Peligroso', 'Riesgo', 'Sospechoso'].includes(parsed.summaryLabel)) action = 'block';
                else if (['Seguro', 'Confidenciable'].includes(parsed.summaryLabel)) action = 'allow';
            }

            if (action === 'none' && (parsed.negVotes > 0 || parsed.posVotes > 0)) {
                if (parsed.negVotes > parsed.posVotes) action = 'block';
                else if (parsed.posVotes > parsed.negVotes) action = 'allow';
            }

            sendPluginResult({
                requestId,
                success: !!(parsed.summaryLabel || parsed.keywordsText || parsed.count > 0 || parsed.commentsText.length > 0 || parsed.negVotes > 0 || parsed.posVotes > 0),
                source: PLUGIN_CONFIG.name,
                phoneNumber: finalResponse.phoneNumber || "unknown",
                sourceLabel: sourceLabel || 'No specific label found',
                predefinedLabel: predefinedLabel,
                action: action,
                name: '', 
                count: parsed.count
            });
        } catch (e) {
            logError("Error in handleResponse", e);
        }
    }

    function generateOutput(phoneNumber, nationalNumber, e164Number, requestId) {
        log(`generateOutput called for requestId: ${requestId}`);
        const numberToQuery = phoneNumber || nationalNumber || e164Number;
        if (!numberToQuery) {
            sendPluginResult({ requestId, success: false, error: "No Number" });
            return;
        }

        let countryCode = "es"; // Default for Spanish
        if (e164Number && e164Number.startsWith('+')) {
            const match = e164Number.match(/^\+(\d{1,2})/);
            if (match && match[1]) {
                let extracted = match[1];
                while (extracted.length > 0) {
                    if (countryCodeMap[extracted]) {
                        countryCode = countryCodeMap[extracted];
                        break;
                    }
                    extracted = extracted.slice(0, -1);
                }
            }
        }

        const digitsOnly = numberToQuery.replace(/[^0-9]/g, '');
        initiateQuery(digitsOnly, requestId, countryCode);
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
