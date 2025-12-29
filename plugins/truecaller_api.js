// [Truecaller] - Native RequestChannel Solution Universal Template V5.2 (Absolute Complete Version)
// =======================================================================================
// TEMPLATE DESCRIPTION:
// Standardized API plugin template. Strictly aligns with the Iframe version (Chinese.js) structure.
//
// CORE FEATURES:
// 1. User Configuration (settings): Users enter API Key etc. in the App.
// 2. Native Request: Uses RequestChannel (Native HTTP) to bypass WebView limitations.
// 3. Structural Consistency: Separates `initiateQuery` and `generateOutput` exactly like the Iframe template.
// =======================================================================================

(function () {
    // IIFE to isolate scope

    // --- SECTION 1: Plugin Configuration (MUST MODIFY) ---
    // ---------------------------------------------------------------------------------------
    // This is the unique identifier for the plugin. Please provide unique info.
    // ---------------------------------------------------------------------------------------
    const PLUGIN_CONFIG = {
        id: 'truecallerPluginchannel', // Must match Dart callback ID
        name: 'Truecaller API Lookup', // Readable Plugin Name
        version: '1.2.0', // Plugin Version
        description: 'Queries Truecaller API using Native RequestChannel.', // Plugin Description
        // Settings Definition
        settings: [
            {
                key: 'auth_token',    // Setting Key
                label: 'Auth Token',  // UI Label
                type: 'text',         // Input Type
                hint: 'Enter Truecaller Auth Token (Bearer)', // Input Hint
                required: true        // Is Required
            },
            {
                key: 'country_code',
                label: 'Default Country Code',
                type: 'text',
                hint: 'e.g: IN, US, CN (Optional)',
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
        'sales': 'Telemarketing',
        'spam': 'Spam Likely',
        'scam': 'Fraud Scam Likely',
        'fraud': 'Fraud Scam Likely',
        'nuisance': 'Spam Likely',
        'political': 'Political',
        'survey': 'Survey',
        'robocall': 'Robocall',
        'agent': 'Agent',
        'collection': 'Debt Collection',
        'finance': 'Financial',
        'charity': 'Charity',
    };

    /**
     * @constant {Array<string>} blockKeywords - Keywords that determine 'block' action
     * @description If the parsed `sourceLabel` or `predefinedLabel` contains any keyword in this list,
     *              the `action` field in the result will be set to 'block'.
     */
    const blockKeywords = [
        'Scam', 'Fraud', 'Spam', 'Telemarketing', 'Robocall'
    ];

    /**
     * @constant {Array<string>} allowKeywords - Keywords that determine 'allow' action
     * @description If the parsed `sourceLabel` or `predefinedLabel` contains any keyword in this list,
     *              and it does not match block criteria, the `action` field will be set to 'allow'.
     */
    const allowKeywords = [
        'Delivery', 'Support', 'Bank', 'Courier', 'Service'
    ];

    // --- SECTION 3: Generic Framework (No need to modify) ---
    // ---------------------------------------------------------------------------------------
    // Core framework code for Flutter communication.
    // ---------------------------------------------------------------------------------------
    function log(message) { console.log(`[${PLUGIN_CONFIG.id} v${PLUGIN_CONFIG.version}] ${message}`); }
    function logError(message, error) { console.error(`[${PLUGIN_CONFIG.id} v${PLUGIN_CONFIG.version}] ${message}`, error); }

    function sendToFlutter(channel, data) {
        if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
            window.flutter_inappwebview.callHandler(channel, JSON.stringify(data));
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

    // --- SECTION 4: Native Request Logic (Core Feature) ---
    
    // Encapsulate RequestChannel call
    function sendNativeRequest(options) {
        const payload = {
            method: options.method,      // 'GET', 'POST', 'PUT', 'DELETE'
            url: options.url,            // Full URL
            headers: options.headers,    // Http Headers
            body: options.body || null,  // Body (for POST/PUT)
            phoneRequestId: options.requestId,
            externalRequestId: options.requestId
        };

        log(`Sending Native Request: ${payload.method} ${payload.url}`);
        
        if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
            window.flutter_inappwebview.callHandler('RequestChannel', JSON.stringify(payload));
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
        
        // 1. Get Config (Injected by App)
        const config = window.plugin[PLUGIN_CONFIG.id].config || {};
        const authToken = config.auth_token || "a1i1V--ua298eldF0hb0rL520GjDz7bzVAdt63J2nzZBnWlEKNCJUeln_7kWj4Ir";
        const countryCode = config.country_code || 'US';
        const userAgent = config.userAgent || 'Truecaller/9.00.3 (Android;10)';

        if (!authToken) {
            sendPluginResult({ requestId, success: false, error: 'Auth Token not configured.' });
            return;
        }

        // 2. Build API Request
        const host = "search5-noneu.truecaller.com";
        const targetSearchUrl = `https://${host}/v2/search?q=${encodeURIComponent(phoneNumber)}&countryCode=${encodeURIComponent(countryCode)}&type=4&locAddr=&placement=SEARCHRESULTS,HISTORY,DETAILS&adId=&encoding=json`;
        
        const headers = {
            "User-Agent": userAgent,
            "Accept": "application/json",
            "Authorization": `Bearer ${authToken}`
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

        if (statusCode !== 200) {
            logError(`HTTP Error: ${statusCode}`);
            let errorMsg = `HTTP Error ${statusCode}`;
            if (statusCode === 401) errorMsg = "Truecaller Token Expired (401)";
            if (statusCode === 429) errorMsg = "Truecaller Rate Limit (429)";
            sendPluginResult({ requestId, success: false, error: errorMsg });
            return;
        }

        try {
            // 1. Parse JSON
            const data = JSON.parse(responseText);
            const info = (data.data && data.data.length > 0) ? data.data[0] : null;

            if (!info) {
                sendPluginResult({ requestId, success: false, error: 'No data found in Truecaller response' });
                return;
            }
            
            // 2. Extract Fields
            const phones = info.phones || [];
            const phoneObj = phones.length > 0 ? phones[0] : {};
            const addresses = info.addresses || [];
            const addrObj = addresses.length > 0 ? addresses[0] : {};

            const name = info.name || '';
            const carrier = phoneObj.carrier || '';
            const city = addrObj.city || '';
            const province = addrObj.countryCode || '';
            
            const isFraud = info.isFraud === true;
            const spamInfo = info.spamInfo || {};
            const spamScore = spamInfo.spamScore || 0;
            const spamType = spamInfo.spamType || '';
            
            // 3. Intelligent Action Logic
            let predefinedLabel = 'Unknown';
            let action = 'none';

            // 3.1 Try Mapping
            if (isFraud) {
                predefinedLabel = 'Fraud Scam Likely';
            } else if (spamType && manualMapping[spamType.toLowerCase()]) {
                predefinedLabel = manualMapping[spamType.toLowerCase()];
            } else if (spamScore > 0) {
                predefinedLabel = 'Spam Likely';
            }

            // 3.2 Determine Action (Block/Allow)
            if (isFraud || spamScore > 0) action = 'block';

            // Check Allow logic if not blocked
             if (action === 'none' && name) {
                 for (const keyword of allowKeywords) {
                    if (name.toLowerCase().includes(keyword.toLowerCase())) {
                        action = 'allow';
                        break;
                    }
                }
            }
            
            // 4. Return Result
            const result = {
                requestId,
                success: true,
                source: PLUGIN_CONFIG.name,
                name: name,
                phoneNumber: phoneObj.e164Format || '',
                carrier: carrier,
                city: city,
                province: province,
                count: spamScore,
                sourceLabel: spamType || (isFraud ? 'Fraud' : 'Normal'),
                predefinedLabel: predefinedLabel,
                action: action,
                imageUrl: info.image || '',
                email: (info.internetAddresses && info.internetAddresses.length > 0) ? info.internetAddresses[0].id : ''
            };
            
            sendPluginResult(result);

        } catch (e) {
            logError('Parsing Error', e);
            sendPluginResult({ requestId, success: false, error: 'JSON Parse Failed: ' + e.message });
        }
    }

    // --- SECTION 7: Public Interface (No need to modify) ---
    // ---------------------------------------------------------------------------------------
    // Entry point called by Flutter.
    // ---------------------------------------------------------------------------------------
    function generateOutput(phoneNumber, nationalNumber, e164Number, requestId) {
        log(`generateOutput called for requestId: ${requestId}`);
        // Use any parameter based on website requirement.
        const numberToQuery = e164Number || phoneNumber || nationalNumber;
        
        if (numberToQuery) {
            initiateQuery(numberToQuery, requestId);
        } else {
            sendPluginResult({ requestId, success: false, error: 'No valid phone number provided.' });
        }
    }

    // --- SECTION 8: Initialization & Registration (No need to modify) ---
    function initialize() {
        if (!window.plugin) window.plugin = {};
        window.plugin[PLUGIN_CONFIG.id] = {
            info: PLUGIN_CONFIG,
            generateOutput: generateOutput,
            handleResponse: handleResponse, // Must expose to native layer
            config: {}
        };
        log(`Plugin registered: window.plugin.${PLUGIN_CONFIG.id}`);
        sendPluginLoaded();
    }

    initialize();

})();
