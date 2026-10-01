// [slickly CN.js] - Slick.ly CN Plugin (Pure FlutterJS Regex V6.0)
// =======================================================================================
// Architecture: Native Channel (httpFetch) + Regex Parsing
// No DOM/Iframe dependencies.
// =======================================================================================

(function (scope) {
    // --- Plugin Configuration ---
    const PLUGIN_CONFIG = {
        id: 'slicklyCnPhoneNumberPlugin',
        name: 'Slick.ly CN Phone Lookup (Regex)',
        version: '6.0.1',
        description: 'Queries Slick.ly for CN phone number information using Regex.',
        config: {
            strategy: 'direct',
            successMarker: "slickly",
            countryCode: "cn"
        },
        settings: [
            { key: 'successMarker', label: 'Success Marker', type: 'text', hint: 'Bypass Marker', required: false }
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
        '可疑': 'Spam Likely', '安全': 'Other', '危险': 'Risk',
        '诈骗': 'Fraud Scam Likely', '骗局': 'Fraud Scam Likely', '垃圾邮件': 'Spam Likely', '骚扰': 'Spam Likely',
        '电话营销': 'Telemarketing', '自动拨号': 'Robocall', '骗子': 'Fraud Scam Likely', '送货': 'Delivery',
        '外卖': 'Takeaway', '叫车服务': 'Ridesharing', '保险': 'Insurance', '贷款': 'Loan',
        '客户服务': 'Customer Service', '未知': 'Unknown', '金融': 'Financial', '银行': 'Bank',
        '教育': 'Education', '医疗': 'Medical', '慈善': 'Charity', '其他': 'Other',
        '催收': 'Debt Collection', '调查': 'Survey', '政治': 'Political', '电子商务': 'Ecommerce',
        '风险': 'Risk', '代理人': 'Agent', '招聘者': 'Recruiter', '猎头': 'Headhunter',
        '互联网': 'Internet', '政府': 'Government', '本地服务': 'Local Services', '电信': 'Telecommunication',
        '中介': 'Agent', '快递': 'Delivery', '教育培训': 'Education', '推销': 'Telemarketing'
    };

    const blockKeywords = ['诈骗', '骚扰', '风险', '催收', '危险', '欺诈', '敲诈', '广告', '推销', '理财', 'Spam', 'Scam', 'Fraud'];
    const allowKeywords = ['送货', '外卖', '快递', '美团', '饿了么', '出租', '滴滴', '网约车', '客服'];

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
        const countryCode = config.countryCode || "cn";
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
            negVotes: 0, posVotes: 0, province: '', city: ''
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
            const countRegex = /(?:註釋|注释)\s*\((\d+)\)/i;
            const countMatch = html.match(countRegex);
            if (countMatch) result.count = parseInt(countMatch[1], 10);

            // 4. Location
            const locationRegex = /<div class=["']basic["']>[\s\S]*?<span>([\s\S]*?)\s*\(中国\)/i;
            const locationMatch = html.match(locationRegex);
            if (locationMatch) {
                const loc = locationMatch[1].trim();
                const splitMatch = loc.match(/^(.+?[省自治区])?(.+?市)/);
                if (splitMatch) {
                    result.province = splitMatch[1] ? splitMatch[1].trim() : '';
                    result.city = splitMatch[2] ? splitMatch[2].trim() : '';
                } else {
                    result.city = loc;
                }
            }

            // 5. Extract Votes
            const negRegex = /<span class=["']negative-count["']>\s*(\d+)\s*<\/span>/i;
            const posRegex = /<span class=["']positive-count["']>\s*(\d+)\s*<\/span>/i;
            const negMatch = html.match(negRegex);
            const posMatch = html.match(posRegex);
            if (negMatch) result.negVotes = parseInt(negMatch[1], 10);
            if (posMatch) result.posVotes = parseInt(posMatch[1], 10);

            // 6. Extract Comments
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
                if (['危险', '可疑'].includes(parsed.summaryLabel)) action = 'block';
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
                count: parsed.count,
                province: parsed.province,
                city: parsed.city
            });
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