// [slicklyHK TW MO.js] - Slick.ly TW/HK/MO Plugin (Pure FlutterJS Regex V6.2)
// =======================================================================================
// Architecture: Native Channel (httpFetch) + Regex Parsing
// No DOM/Iframe dependencies.
// =======================================================================================

(function (scope) {
    // --- Plugin Configuration ---
    const PLUGIN_CONFIG = {
        id: 'slicklyTwHkPhoneNumberPlugin',
        name: 'Slick.ly TW/HK/MO Phone Lookup (Regex)',
        version: '6.2.1',
        description: 'Queries Slick.ly for TW/HK/MO phone number information using Regex.',
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
        '安全': 'Other', '危險': 'Risk', '可疑': 'Spam Likely',
        '詐騙': 'Fraud Scam Likely', '騙局': 'Fraud Scam Likely', '垃圾郵件': 'Spam Likely', '騷擾': 'Spam Likely',
        '電話行銷': 'Telemarketing', '自動撥號': 'Robocall', '騙子': 'Fraud Scam Likely', '送貨': 'Delivery',
        '外賣': 'Takeaway', '叫車服務': 'Ridesharing', '保險': 'Insurance', '貸款': 'Loan',
        '客戶服務': 'Customer Service', '未知': 'Unknown', '金融': 'Financial', '銀行': 'Bank',
        '教育': 'Education', '醫療': 'Medical', '慈善': 'Charity', '其他': 'Other',
        '催收': 'Debt Collection', '調查': 'Survey', '政治': 'Political', '電子商務': 'Ecommerce',
        '風險': 'Risk', '代理人': 'Agent', '招募者': 'Recruiter', '獵頭': 'Headhunter',
        '互聯網': 'Internet', '政府': 'Government', '在地服務': 'Local Services', '電信': 'Telecommunication',
        '補習班': 'Education', '掛斷': 'Other', '無聲': 'Silent Call Voice Clone', '推銷': 'Telemarketing'
    };

    const blockKeywords = ['詐騙', '騙局', '騷擾', '風險', '債務', '推銷', '欺詐', '廣告', 'Spam', 'Scam', 'Fraud'];
    const allowKeywords = ['送貨', '外賣', '快遞', '叫車', '安全', '客服'];

    const countryCodeMap = {
        '886': 'tw', '852': 'hk', '853': 'mo'
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

        const digitsOnly = phoneNumber.replace(/[^0-9]/g, '');
        const targetUrl = `https://slick.ly/${countryCode.toLowerCase()}/${digitsOnly}`;

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
                if (['危險', '風險', '可疑'].includes(parsed.summaryLabel)) action = 'block';
                else if (parsed.summaryLabel === '安全') action = 'allow';
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

        let countryCode = "tw"; // Default
        if (e164Number && e164Number.startsWith('+')) {
            const match = e164Number.match(/^\+(\d{1,3})/);
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
