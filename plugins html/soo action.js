/**
 * Soo (Dio/Regex) Plugin - Standardized Version
 * Follows Universal_Regex_API_HTML_CN.js template structure.
 */
(function(scope) {
    // --- 1. Config ---
    const PLUGIN_CONFIG = {
        id: 'sooPhoneNumberPlugin',
        name: 'Soo (Dio/Regex)',
        version: '6.2.1',
        description: 'Queries so.com using Dio and Regex parsing with standard structure.',
        config: {
            strategy: 'direct',
            successMarker: "标记",
        }
    };

    // --- 2. Constants ---
    const manualMapping = {
        '保险理财': 'Financial',
        '骚扰电话': 'Fraud Scam Likely',
        '非应邀商业电话': 'Spam Likely',
        '保险推销': 'Insurance',
        '贷款理财': 'Loan',
        '房产中介': 'Agent',
        '收货快递': 'Delivery',
        '送餐外卖': 'Takeaway',
        '广告营销': 'Telemarketing',
        '客服热线': 'Customer Service',
        '教育培训': 'Education',
        '涉诈电话': 'Fraud Scam Likely',
        '违法': 'Risk',
        '推销': 'Telemarketing',
    };

    // --- 3. Helpers ---
    function log(message) {
        if (typeof sendMessage === 'function') {
            sendMessage('Log', JSON.stringify(`[${PLUGIN_CONFIG.id}] ${message}`));
        }
    }

    function sendPluginResult(result) {
        if (typeof sendMessage === 'function') {
            sendMessage('PluginResultChannel', JSON.stringify(result));
        }
    }

    // --- 4. Response / Regex ---
    function parseHTML(html) {
        const result = {
            count: 0,
            sourceLabel: "",
            province: "",
            city: "",
            carrier: "",
            success: false,
        };

        if (!html) return result;

        // Label extraction
        const labelMatch = html.match(/疑似为([\s\S]*?)(?:电话)?！/i) || 
                           html.match(/<span class=["']mh-tel-mark["'][^>]*>([\s\S]*?)<\/span>/i);
        
        if (labelMatch) {
            let labelText = labelMatch[1].replace(/<[^>]+>/g, '').trim();
            result.sourceLabel = labelText;
        }

        // Count extraction
        const countMatch = html.match(/被<b>(\d+)<\/b>位/i);
        if (countMatch) {
            result.count = parseInt(countMatch[1], 10);
        }

        // Location & Carrier extraction
        const locationMatch = html.match(/<div class=["']mh-detail["'][^>]*>.*?<span>.*?<\/span>.*?<span>\s*([一-龥]+)\s*([一-龥]+)?\s*([一-龥]+)?\s*<\/span>/i);
        if (locationMatch) {
            result.province = locationMatch[1] || '';
            result.city = locationMatch[2] || '';
            result.carrier = locationMatch[3] || '';
        }

        result.success = !!(result.sourceLabel || result.count > 0);
        return result;
    }

    function handleResponse(response) {
        log("handleResponse called.");
        try {
            let finalResponse = null;
            if (response && typeof response === 'object') {
                finalResponse = response;
            } else if (typeof response === 'string') {
                finalResponse = JSON.parse(response);
            }

            if (!finalResponse || (finalResponse.status !== 200 && finalResponse.status !== 0)) {
                log(`Error in response: ${finalResponse ? finalResponse.error : 'Null response'}`);
                sendPluginResult({ success: false, error: 'Network Error' });
                return;
            }

            const html = finalResponse.responseText || "";
            const parsed = parseHTML(html);
            const requestId = finalResponse.requestId || finalResponse.phoneRequestId;

            let predefinedLabel = manualMapping[parsed.sourceLabel] || 'Unknown';
            let action = 'none';

            if (parsed.success) {
                const blockKeywords = ['推销', '推广', '广告', '违规', '诈', '反动', '营销', '商业电话', '贷款', '理财'];
                if (blockKeywords.some(k => parsed.sourceLabel.includes(k))) {
                    action = 'block';
                }
            }

            sendPluginResult({
                requestId,
                success: parsed.success,
                source: PLUGIN_CONFIG.name,
                sourceLabel: parsed.sourceLabel,
                predefinedLabel: predefinedLabel,
                action: action,
                count: parsed.count,
                province: parsed.province,
                city: parsed.city,
                carrier: parsed.carrier
            });

        } catch (e) {
            log(`Error in handleResponse: ${e}`);
            sendPluginResult({ success: false, error: e.toString() });
        }
    }

    // --- 5. Request (Entry Points) ---
    function generateOutput(phoneNumber, nationalNumber, e164Number, requestId) {
        log(`generateOutput for ${phoneNumber}`);
        const targetUrl = `https://www.so.com/s?q=${encodeURIComponent(phoneNumber)}`;
        const config = (scope.plugin && scope.plugin[PLUGIN_CONFIG.id] && scope.plugin[PLUGIN_CONFIG.id].config) || {};
        const userAgent = config.userAgent || 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
        
        sendMessage('httpFetch', JSON.stringify({
            url: targetUrl,
            method: 'GET',
            headers: { 'User-Agent': userAgent },
            pluginId: PLUGIN_CONFIG.id,
            phoneRequestId: requestId,
            successMarker: PLUGIN_CONFIG.config.successMarker,
            strategy: config.strategy || 'direct'
        }));
    }

    // --- 6. Initialization ---
    function initialize() {
        scope.plugin = scope.plugin || {};
        scope.plugin[PLUGIN_CONFIG.id] = {
            info: PLUGIN_CONFIG,
            generateOutput: generateOutput,
            handleResponse: handleResponse,
            config: {}
        };
        log("Standardized Soo Dio Plugin Initialized.");
    }

    initialize();

})(globalThis);