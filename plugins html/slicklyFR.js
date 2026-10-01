// [slicklyFR.js] - Slick.ly FR Plugin (Pure FlutterJS Regex V6.2)
// =======================================================================================
// Architecture: Native Channel (httpFetch) + Regex Parsing
// No DOM/Iframe dependencies.
// =======================================================================================

(function (scope) {
    // --- Plugin Configuration ---
    const PLUGIN_CONFIG = {
        id: 'slicklyFrPhoneNumberPlugin',
        name: 'Slick.ly FR (Regex)',
        version: '6.2.1',
        description: 'Queries Slick.ly (FR) for phone number information using Regex.',
        config: {
            strategy: 'direct',
            successMarker: "slickly",
            countryCode: "fr"
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
        'Dangereux': 'Risk', 'Méfiant': 'Spam Likely',
        'Fraude': 'Fraud Scam Likely', 'Arnaque': 'Fraud Scam Likely', 'Escroquerie': 'Fraud Scam Likely',
        'Imposture': 'Fraud Scam Likely', 'Supercherie': 'Fraud Scam Likely', 'Spam': 'Spam Likely',
        'Indésirable': 'Spam Likely', 'Pourriel': 'Spam Likely', 'Non sollicité': 'Spam Likely',
        'Télémarketing': 'Telemarketing', 'Marketing téléphonique': 'Telemarketing',
        'Démarchage téléphonique': 'Telemarketing', 'Robocall': 'Robocall',
        'Appel automatique': 'Robocall', 'Robot': 'Robocall', 'Livraison': 'Delivery',
        'Expédition': 'Delivery', 'Distribution': 'Delivery', 'Plats à emporter': 'Takeaway',
        'À emporter': 'Takeaway', 'Vente à emporter': 'Takeaway', 'Covoiturage': 'Ridesharing',
        'Partage de voiture': 'Ridesharing', 'Voiture partagée': 'Ridesharing',
        'Assurance': 'Insurance', 'Police': 'Insurance', 'Couverture': 'Insurance',
        'Prêt': 'Loan', 'Emprunt': 'Loan', 'Crédit': 'Loan',
        'Service client': 'Customer Service', 'Assistance': 'Customer Service', 'Support': 'Customer Service',
        'Inconnu': 'Unknown', 'Masqué': 'Unknown', 'Non identifié': 'Unknown',
        'Financier': 'Financial', 'Argent': 'Financial', 'Finance': 'Financial',
        'Banque': 'Bank', 'Bancaire': 'Bank', 'Compte': 'Bank',
        'Éducation': 'Education', 'Formation': 'Education', 'École': 'Education',
        'Médical': 'Medical', 'Santé': 'Medical', 'Docteur': 'Medical',
        'Charité': 'Charity', 'Don': 'Charity', 'Association caritative': 'Charity',
        'Autre': 'Other', 'Divers': 'Other', 'Varié': 'Other',
        'Recouvrement de créances': 'Debt Collection', 'Dette': 'Debt Collection', 'Facture impayée': 'Debt Collection',
        'Sondage': 'Survey', 'Enquête': 'Survey', 'Questionnaire': 'Survey',
        'Politique': 'Political', 'Élection': 'Political', 'Parti politique': 'Political',
        'Commerce électronique': 'Ecommerce', 'Boutique en ligne': 'Ecommerce', 'Vente en ligne': 'Ecommerce',
        'Risque': 'Risk', 'Danger': 'Risk', 'Menace': 'Risk',
        'Agent': 'Agent', 'Représentant': 'Agent', 'Intermédiaire': 'Agent',
        'Recruteur': 'Recruiter', 'RH': 'Recruiter', 'Ressources humaines': 'Recruiter',
        'Chasseur de têtes': 'Headhunter', 'Executive Search': 'Headhunter', 'Recrutement de cadres': 'Headhunter',
        'Appel silencieux': 'Silent Call Voice Clone', 'Silence au téléphone': 'Silent Call Voice Clone',
        'Aucune réponse': 'Silent Call Voice Clone', 'Clone de voix': 'Silent Call Voice Clone',
        'Fausse voix': 'Silent Call Voice Clone', 'Imitation de voix': 'Silent Call Voice Clone',
        'Internet': 'Internet', 'En ligne': 'Internet', 'Web': 'Internet',
        'Voyages et billets': 'Travel Ticketing', 'Tourisme': 'Travel Ticketing', 'Billets d avion': 'Travel Ticketing',
        'Logiciel d application': 'Application Software', 'Application': 'Application Software', 'Programme': 'Application Software',
        'Divertissement': 'Entertainment', 'Spectacle': 'Entertainment', 'Cinéma': 'Entertainment',
        'Gouvernement': 'Government', 'État': 'Government', 'Autorité': 'Government',
        'Services locaux': 'Local Services', 'Services de proximité': 'Local Services', 'Services municipaux': 'Local Services',
        'Industrie automobile': 'Automotive Industry', 'Automobile': 'Automotive Industry', 'Voiture': 'Automotive Industry',
        'Location de voitures': 'Car Rental', 'Voiture de location': 'Car Rental', 'Véhicule de location': 'Car Rental',
        'Télécommunications': 'Telecommunication', 'Communications': 'Telecommunication', 'Téléphonie': 'Telecommunication'
    };

    const blockKeywords = [
        'Fraude', 'Arnaque', 'Escroquerie', 'Imposture', 'Supercherie', 'Spam', 'Indésirable', 'Pourriel',
        'Télémarketing', 'Marketing téléphonique', 'Robocall', 'Appel automatique',
        'Recouvrement de créances', 'Dette', 'Dangereux', 'Méfiant'
    ];
    const allowKeywords = [
        'Livraison', 'Expédition', 'Plats à emporter', 'À emporter', 'Covoiturage', 'Assurance', 'Service client', 'Assistance'
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
        const successMarker = config.successMarker || "slickly";
        const countryCode = config.countryCode || "fr";
        const userAgent = config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

        const digitsOnly = phoneNumber.replace(/[^0-9]/g, '');
        const targetUrl = `https://slick.ly/${countryCode}/${digitsOnly}`;

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
                if (['Dangereux', 'Risque', 'Méfiant'].includes(parsed.summaryLabel)) action = 'block';
                else if (parsed.summaryLabel === 'Sûr') action = 'allow';
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

        const digitsOnly = numberToQuery.replace(/[^0-9]/g, '');
        initiateQuery(digitsOnly, requestId);
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