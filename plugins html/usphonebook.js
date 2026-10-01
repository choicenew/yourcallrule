// [usphonebook.js] - USPhonebook Plugin (Pure FlutterJS Regex V6.0)
// =======================================================================================
// Architecture: Native Channel (httpFetch) + Regex Parsing
// No DOM/Iframe dependencies.
// =======================================================================================

(function (scope) {
    // --- Plugin Configuration ---
    const PLUGIN_CONFIG = {
        id: 'usphonebookPhoneNumberPlugin',
        name: 'USPhonebook Phone Lookup (Regex)',
        version: '6.0.1',
        description: 'Queries usphonebook.com for phone number information using Regex.',
        config: {
            strategy: 'direct',
            successMarker: "usphonebook",
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
        'spam': 'Spam Likely',
        'fraud': 'Fraud Scam Likely',
        'danger': 'Risk',
        'safe': 'Other',
        'success': 'Other'
    };

    const blockKeywords = [
        'Spam', 'Scam', 'Fraud', 'Telemarketing', 'Robocall', 'Debt', 'Risk', 'Silent', 'Danger', 'Harassment'
    ];

    const allowKeywords = [
        'Delivery', 'Takeaway', 'Insurance', 'Customer Service', 'Bank', 'Medical', 'Charity', 'Trusted', 'Safe', 'Allow'
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
        const successMarker = config.successMarker || "usphonebook";
        const userAgent = config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

        // Format for USPhonebook (usually expects xxx-xxx-xxxx)
        const digitsOnly = phoneNumber.replace(/[^0-9]/g, '');
        let formattedNumber = digitsOnly;
        if (digitsOnly.length === 10) {
            formattedNumber = digitsOnly.substring(0, 3) + '-' + digitsOnly.substring(3, 6) + '-' + digitsOnly.substring(6);
        } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
            formattedNumber = digitsOnly.substring(1, 4) + '-' + digitsOnly.substring(4, 7) + '-' + digitsOnly.substring(7);
        }

        const targetUrl = `https://www.usphonebook.com/${encodeURIComponent(formattedNumber)}`;

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
            // itemprop="givenName">First</strong> <strong itemprop="familyName">Last</strong>
            const givenNameRegex = /itemprop=["']givenName["']>([\s\S]*?)<\/strong>/i;
            const familyNameRegex = /itemprop=["']familyName["']>([\s\S]*?)<\/strong>/i;
            
            const givenMatch = html.match(givenNameRegex);
            const familyMatch = html.match(familyNameRegex);
            
            if (givenMatch || familyMatch) {
                const given = givenMatch ? givenMatch[1].trim() : '';
                const family = familyMatch ? familyMatch[1].trim() : '';
                result.name = (given + ' ' + family).trim();
            }

            // 2. Spam/Fraud Status
            // class="block-success", "block-warning", "block-danger"
            const spamStatusRegex = /class=["'](?:block-success|block-warning|block-danger)["'][^>]*>([\s\S]*?)<\/div>/i;
            const spamMatch = html.match(spamStatusRegex);
            if (spamMatch) {
                result.sourceLabel = spamMatch[1].trim();
                const status = result.sourceLabel.toLowerCase();
                if (status.includes('safe')) result.predefinedLabel = 'Safe';
                else if (status.includes('spam') || status.includes('fraud')) result.predefinedLabel = 'Spam Likely';
                else result.predefinedLabel = 'Unknown';
            }

            result.success = (result.name !== "" || result.sourceLabel !== "");

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
                const checkStr = (parsed.sourceLabel + " " + (parsed.predefinedLabel || '')).toLowerCase();
                let determinedAction = 'none';
                if (blockKeywords.some(k => checkStr.includes(k.toLowerCase()))) {
                    determinedAction = 'block';
                } else if (allowKeywords.some(k => checkStr.includes(k.toLowerCase()))) {
                    determinedAction = 'allow';
                }
                parsed.action = determinedAction;
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
