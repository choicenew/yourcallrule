/**
 * Sogou (Dio/Regex) Plugin - Standardized Version
 * Follows Universal_Regex_API_HTML_CN.js template structure.
 */
(function(scope) {
    // --- 1. Config ---
    const PLUGIN_CONFIG = {
        id: 'sogouPhoneNumberPlugin',
        name: 'Sogou (Dio/Regex)',
        version: '2.0.1',
        description: 'Queries sogou.com using Dio and Regex parsing.',
        config: {
            strategy: 'direct',
            successMarker: "搜狗搜索",
        }
    };

    // --- 2. Constants ---
    const manualMapping = {
        '中介': 'Agent',
        '房产中介': 'Agent',
        '快递物流': 'Delivery',
        '快递': 'Delivery',
        '教育培训': 'Education',
        '金融': 'Financial',
        '保险理财': 'Financial',
        '涉诈电话': 'Fraud Scam Likely',
        '招聘': 'Recruiter',
        '保险推销': 'Insurance',
        '贷款理财': 'Loan',
        '医疗卫生': 'Medical',
        '送餐外卖': 'Takeaway',
        '网约车': 'Ridesharing',
        '违法': 'Risk',
        '客服热线': 'Customer Service',
        '非应邀商业电话': 'Spam Likely',
        '广告推销': 'Telemarketing',
        '推销': 'Telemarketing',
        '骚扰电话': 'Spam Likely',
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

        // Label extraction - Sogou Search Mobile patterns
        // 1. Mobile Vrwrap pattern
        let labelMatch = html.match(/class=["']text-layout["'][^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i) || 
                         html.match(/<span[^>]*class=["']mark["'][^>]*>([\s\S]*?)<\/span>/i) ||
                         html.match(/<p class=["']text-layout["'][^>]*>([\s\S]*?)<\/p>/i);
        
        if (labelMatch) {
            let labelText = labelMatch[1].replace(/<[^>]+>/g, '').trim();
            labelText = labelText.replace(/^疑似为\s*/, '').replace(/\s*电话$/, '');
            result.sourceLabel = labelText;
        }

        result.success = !!(result.sourceLabel);
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
            log("HTML Head: " + html.slice(0, 500).replace(/\n/g, ' '));
            
            const parsed = parseHTML(html);
            const requestId = finalResponse.requestId || finalResponse.phoneRequestId;

            let predefinedLabel = 'Unknown';
            for (const key in manualMapping) {
                if (parsed.sourceLabel.includes(key)) {
                    predefinedLabel = manualMapping[key];
                    break;
                }
            }

            let action = 'none';
            if (parsed.success) {
                const blockKeywords = ['推销', '广告', '骚扰', '诈骗', '违法', '营销', '贷款'];
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
        const targetUrl = `https://www.sogou.com/web?query=${encodeURIComponent(phoneNumber)}`;
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
        log("Standardized Sogou Dio Plugin Initialized.");
    }

    initialize();

})(globalThis);