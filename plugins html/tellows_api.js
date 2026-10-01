// [Tellows] - Native RequestChannel Solution Universal Template V5.2 (Absolute Complete Version)
// =======================================================================================
// TEMPLATE DESCRIPTION:
// Standardized API plugin template. Strictly aligns with the Iframe version (Chinese.js) structure.
//
// CORE FEATURES:
// 1. User Configuration (settings): Users enter API Key etc. in the App.
// 2. Native Request: Uses RequestChannel (Native HTTP) to bypass WebView limitations.
// 3. Structural Consistency: Separates `initiateQuery` and `generateOutput` exactly like the Iframe template.
// =======================================================================================

(function (scope) {
    // IIFE to isolate scope

    // --- SECTION 1: Plugin Configuration (MUST MODIFY) ---
    // ---------------------------------------------------------------------------------------
    // This is the unique identifier for the plugin. Please provide unique info.
    // ---------------------------------------------------------------------------------------
    const PLUGIN_CONFIG = {
        id: 'tellowsPlugin', // Unique Plugin ID
        name: 'Tellows API Lookup', // Readable Plugin Name
        version: '1.2.0', // Plugin Version
        description: 'Queries Tellows API using Native RequestChannel (XML).', // Plugin Description
        config: {
            strategy: 'direct',
        },
        // Settings Definition
        settings: [
            {
                key: 'api_key',       // Setting Key
                label: 'API Key',     // UI Label
                type: 'text',         // Input Type
                hint: 'Enter Tellows API Key', // Input Hint
                required: true        // Is Required
            },
            {
                key: 'country',
                label: 'Country Code',
                type: 'text',
                hint: 'Default: us',
                required: false
            }
        ]
    };

    // --- SECTION 2: Data Mapping & Keywords (Modify as needed) ---
    // ---------------------------------------------------------------------------------------
    // Defines how to map API raw labels (sourceLabel) to standard labels (predefinedLabel).
    // ---------------------------------------------------------------------------------------

    /**
     * @constant {Array<Object>} predefinedLabels - Standard app labels.
     */
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

    /**
     * @constant {Object} manualMapping - Manual mapping table.
     * Key is the raw value from API, Value is standard label.
     */
    const manualMapping = {
        'scam': 'Fraud Scam Likely',
        'spam': 'Spam Likely',
        'sales': 'Telemarketing',
        'delivery': 'Delivery',
    };

    /**
     * @constant {Array<string>} blockKeywords - Keywords that determine 'block' action
     * @description If the parsed `sourceLabel` or `predefinedLabel` contains any keyword in this list,
     *              the `action` field in the result will be set to 'block'.
     */
    const blockKeywords = [
        'Spam', 'Scam', 'Fraud', 'Telemarketing', 'Robocall', 'Debt', 'Risk', 'Silent', 'Nuisance', 'Harassment',
        'Prank', 'Phishing', 'Kostenfalle', 'Unseriös', 'Betrug', 'Werbeanruf', 'Telefonterror', 'Abzocke',
        'Gewinnspiel', 'Inkasso', 'Umfrage', 'Meinungsforschung', 'Callcenter', 'Ping Anruf', 'Bandansage',
        'Gefährlich', 'Verdächtig', 'Molesto', 'Publicidad', 'Cobranza', 'Acoso', 'Estafa', 'Fraude'
    ];

    /**
     * @constant {Array<string>} allowKeywords - Keywords that determine 'allow' action
     * @description If the parsed `sourceLabel` or `predefinedLabel` contains any keyword in this list,
     *              and it does not match block criteria, the `action` field will be set to 'allow'.
     */
    const allowKeywords = [
        'Delivery', 'Takeaway', 'Insurance', 'Customer Service', 'Bank', 'Medical', 'Charity', 'Trusted', 'Safe',
        'Confirmation', 'Zustellung', 'Versicherung', 'Spenden', 'Service', 'Termin', 'Bestellung', 'Lieferung',
        'Kundenbetreuung', 'Fiable', 'Entrega', 'Positivo'
    ];

    // --- SECTION 3: Generic Framework (No need to modify) ---
    // ---------------------------------------------------------------------------------------
    // Core framework code for Flutter communication.
    // ---------------------------------------------------------------------------------------
    function log(message) { if (typeof sendMessage === 'function') sendMessage('Log', JSON.stringify(`[${PLUGIN_CONFIG.id}] ${message}`)); }
    function logError(message, error) { if (typeof sendMessage === 'function') sendMessage('Log', JSON.stringify(`[${PLUGIN_CONFIG.id}] [ERROR] ${message} ${error ? error.toString() : ''}`)); }

    function sendToFlutter(channel, data) {
        if (typeof sendMessage === 'function') {
            sendMessage(channel, JSON.stringify(data));
        } else if (scope.flutter_inappwebview && scope.flutter_inappwebview.callHandler) {
            scope.flutter_inappwebview.callHandler(channel, JSON.stringify(data));
        } else {
            console.error(`Native channel '${channel}' not found.`);
        }
    }

    function sendPluginResult(result) {
        log(`Sending final result to Flutter: ${JSON.stringify(result)}`);
        sendToFlutter('PluginResultChannel', result);
    }

    function sendPluginLoaded() {
        log('Plugin loaded, notifying Flutter.');
        sendToFlutter('TestPageChannel', { type: 'pluginLoaded', pluginId: PLUGIN_CONFIG.id, version: PLUGIN_CONFIG.version });
    }

    // --- SECTION 4.1: Internal State (Request Cache) ---
    const requestCache = {};

    // --- SECTION 4: Native Request Logic (Core Feature) ---
    
    // Encapsulate RequestChannel call
    function sendNativeRequest(options) {
        const payload = {
            method: options.method,      // 'GET', 'POST', 'PUT', 'DELETE'
            url: options.url,            // Full URL
            headers: options.headers,    // Http Headers
            body: options.body || null,  // Body (for POST/PUT)
            phoneRequestId: options.requestId,
            externalRequestId: options.requestId,
            strategy: 'direct'
        };

        log(`Sending Native Request: ${payload.method} ${payload.url}`);
        
        if (typeof sendMessage === 'function') {
            sendMessage('RequestChannel', JSON.stringify(payload));
        } else if (scope.flutter_inappwebview && scope.flutter_inappwebview.callHandler) {
            scope.flutter_inappwebview.callHandler('RequestChannel', JSON.stringify(payload));
        } else {
            sendPluginResult({ requestId: options.requestId, success: false, error: 'RequestChannel unavailable.' });
        }
    }

    // --- SECTION 5: Query Initiation Logic (Modify as needed) ---
    // ---------------------------------------------------------------------------------------
    // Constructs request parameters based on phone number and initiates query via RequestChannel.
    // ---------------------------------------------------------------------------------------
    function initiateQuery(phoneNumber, requestId) {
        log(`Initiating query for '${phoneNumber}' (requestId: ${requestId})`);
        
        // Cache the phone number for retrieval in handleResponse
        requestCache[requestId] = phoneNumber;

        // 1. Get Config (Injected by App)
        const config = (scope.plugin && scope.plugin[PLUGIN_CONFIG.id].config) || {};
        const apiKey = config.api_key || 'koE5hjkOwbHnmcADqZuqqq2';
        const country = config.country || 'us';
        const userAgent = config.userAgent || 'Dalvik/2.1.0 (Linux; U; Android 6.0; I14 Pro Max Build/MRA58K)';

        if (!apiKey) {
            sendPluginResult({ requestId, success: false, error: 'API Key not configured.' });
            return;
        }

        // 2. Build API Request
        // https://www.tellows.de/basic/num/$number?xml=1&partner=androidapp&apikey=...
        const baseUrl = `https://www.tellows.de/basic/num/${encodeURIComponent(phoneNumber)}`;
        const params = new URLSearchParams({
            xml: '1',
            partner: 'androidapp',
            apikey: apiKey,
            overridecountryfilter: '1',
            country: country,
            showcomments: '50'
        });

        const targetSearchUrl = `${baseUrl}?${params.toString()}`;
        
        const headers = {
            "User-Agent": userAgent,
            "Host": "www.tellows.de",
            "Connection": "Keep-Alive"
        };

        sendNativeRequest({
            method: 'GET',
            url: targetSearchUrl, 
            headers: headers,
            requestId: requestId
        });
    }

    // --- SECTION 6: Response Handling Logic (Core Parsing) ---
    // ---------------------------------------------------------------------------------------
    // Callback after Native layer completes request. Parse JSON/XML here.
    // ---------------------------------------------------------------------------------------
    function handleResponse(response) {
        log('Received response from Native layer');
        
        const requestId = response.phoneRequestId;
        const statusCode = response.status;
        const responseText = response.responseText; // Raw text
        log('Raw Response Text: ' + responseText); // Debug: Print original JSON/XML

        // Retrieve original phone number from cache
        const originalPhoneNumber = requestCache[requestId] || '';
        delete requestCache[requestId]; // Clean up

        if (statusCode !== 200) {
            logError(`HTTP Error: ${statusCode}`);
            sendPluginResult({ requestId, success: false, error: `HTTP Error ${statusCode}` });
            return;
        }

        try {
            // 1. Parse XML using Regex (DOMParser not available in Pure JS)
            function getXmlTag(tag, text) {
                const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
                const match = text.match(regex);
                return match ? match[1].trim() : "";
            }

            const scoreStr = getXmlTag('score', responseText) || "0";
            const score = parseInt(scoreStr, 10);

            const callerName = getXmlTag('caller', responseText);
            const returnedNum = getXmlTag('num', responseText);
            
            // Use returnedNum if available, otherwise fallback to originalPhoneNumber
            const finalPhoneNumber = returnedNum || originalPhoneNumber;

            // 3. Intelligent Action Logic
            const isSpam = score >= 7; // score 1-9
            
            let predefinedLabel = isSpam ? 'Spam Likely' : 'Unknown';
            let action = isSpam ? 'block' : 'none';
            const sourceLabel = `Score: ${score}`;

            // 3.1 Try Mapping (Simple Logic for now)
            // ...

            // 3.2 Determine Action (If isSpam is false, check allow list using callerName)
            if (!isSpam) {
                 // Check block keywords first even if score is low (e.g. "Silient Call" with low score)
                const checkText = (callerName + " " + (returnedNum || "")).toLowerCase();
                 for (const k of blockKeywords) {
                     if (checkText.includes(k.toLowerCase())) {
                         action = 'block';
                         break;
                     }
                 }
                
                 if (action !== 'block' && callerName) {
                    for (const keyword of allowKeywords) {
                        if (callerName.toLowerCase().includes(keyword.toLowerCase())) {
                            action = 'allow';
                            break;
                        }
                    }
                 }
            }
            
            // 4. Return Result
            const result = {
                requestId,
                success: true,
                source: PLUGIN_CONFIG.name,
                name: callerName || (isSpam ? "Spam Caller" : "Unknown"),
                phoneNumber: finalPhoneNumber,
                sourceLabel: sourceLabel,
                predefinedLabel: predefinedLabel,
                action: action,
                // Other fields
                rating: score,
                count: score
            };
            
            sendPluginResult(result);

        } catch (e) {
            logError('Parsing Error', e);
            logError('Original Response for debugging: ', responseText);
            sendPluginResult({ requestId, success: false, error: 'XML Parse Failed: ' + e.message });
        }
    }

    // --- SECTION 7: Public Interface (No need to modify) ---
    // ---------------------------------------------------------------------------------------
    // Entry point called by Flutter.
    // ---------------------------------------------------------------------------------------
    function generateOutput(phoneNumber, nationalNumber, e164Number, requestId) {
        log(`generateOutput called for requestId: ${requestId}`);
        // Use any parameter based on website requirement.
        const numberToQuery = e164Number || phoneNumber || nationalNumber; // Tellows prefers full format
        
        if (numberToQuery) {
            initiateQuery(numberToQuery, requestId);
        } else {
            sendPluginResult({ requestId, success: false, error: 'No valid phone number provided.' });
        }
    }

    // --- SECTION 8: Initialization & Registration (No need to modify) ---
    function initialize() {
        if (!scope.plugin) scope.plugin = {};
        scope.plugin[PLUGIN_CONFIG.id] = {
            info: PLUGIN_CONFIG,
            generateOutput: generateOutput,
            handleResponse: handleResponse, // Must expose to native layer
            config: {}
        };
        log(`Plugin registered: scope.plugin.${PLUGIN_CONFIG.id}`);
        sendPluginLoaded();
    }

    initialize();

})(globalThis);
