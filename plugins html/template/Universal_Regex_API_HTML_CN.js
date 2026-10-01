// [Universal_Regex_API_HTML_CN.js] - FlutterJS 通用正则 HTML 插件模板 V6.1.2
// =======================================================================================
// 模板说明:
// 专为 "HTML 下载 + 正则提取" 场景设计 (QuickJS 环境)。
// 移除了 async/await 的 httpFetch 调用，改为 Native 回调模式。
// =======================================================================================

(function(scope) {
    // --- 区域 1: 配置 ---
    const PLUGIN_CONFIG = {
        id: 'universalRegexHtmlCn',
        name: '通用 HTML 正则插件 (CN)',
        version: '6.1.2',
        description: 'Universal Regex Plugin using Native Channel',
        // --- strategy 策略说明 ---
        // 'direct' (默认): 原生 HTTP / 正则提取模式 (SSR)。适用于 90%+ 搜索网站。200 OK 网页直接传给 JS 正则解析，未标记号码返回 No Match，绝不触发无头 WebView。
        // 'render': 无头 WebView 动态渲染/过盾模式 (SPA)。适用于百度等 AJAX 动态渲染或需要 Cloudflare 盾渲染的网页。
        config: {
            strategy: 'direct', // 'direct' | 'render'
        },
        settings: [
            {
                key: 'target_url',
                label: 'URL 模板',
                type: 'text',
                hint: 'https://ex.com/s/{num}',
                required: true
            },
            {
                key: 'label_regex',
                label: 'Regex (捕获组1)',
                type: 'text',
                hint: 'class="tag">([^<]+)<',
                required: true
            },
            {
                key: 'successMarker',
                label: 'Success Marker',
                type: 'text',
                hint: '过盾标识',
                required: false
            }
        ]
    };

    // --- 区域 2: 映射 (略) ---
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

    const manualMapping = { 'scam': 'Fraud Scam Likely' };
    const blockKeywords = ['骚扰', '诈骗', '骗子', '推销', '广告', '风险', 'Risk', 'Scam', '违规', '反动'];
    const allowKeywords = ['快递', '外卖', '送餐', '客服', '银行', '验证码', '出租', '滴滴', '优步'];

    // --- 区域 3: 工具 ---
    function log(msg) { if (typeof sendMessage === 'function') sendMessage('Log', JSON.stringify(`[${PLUGIN_CONFIG.id}] ${msg}`)); }
    function logError(msg) { if (typeof sendMessage === 'function') sendMessage('Log', JSON.stringify(`[${PLUGIN_CONFIG.id}] [ERROR] ${msg}`)); }
    function sendPluginResult(res) {
        if (typeof sendMessage === 'function') {
            sendMessage('PluginResultChannel', JSON.stringify(res));
        } else if (scope.flutter_inappwebview && scope.flutter_inappwebview.callHandler) {
            scope.flutter_inappwebview.callHandler('PluginResultChannel', JSON.stringify(res));
        }
    }
    function sendPluginLoaded() {
        if (typeof sendMessage === 'function') {
            sendMessage('TestPageChannel', JSON.stringify({ type: 'pluginLoaded', pluginId: PLUGIN_CONFIG.id }));
        } else if (scope.flutter_inappwebview && scope.flutter_inappwebview.callHandler) {
            scope.flutter_inappwebview.callHandler('TestPageChannel', JSON.stringify({ type: 'pluginLoaded', pluginId: PLUGIN_CONFIG.id }));
        }
    }

    // --- 区域 4: 请求 ---
    function initiateQuery(phoneNumber, requestId) {
        const config = (scope.plugin && scope.plugin[PLUGIN_CONFIG.id].config) || {};
        const urlTemplate = config.target_url;
        const successMarker = config.successMarker;

        if (!urlTemplate) {
            sendPluginResult({ requestId, success: false, error: "No URL Template" });
            return;
        }

        const targetUrl = urlTemplate.replace('{num}', encodeURIComponent(phoneNumber));

        sendMessage('httpFetch', JSON.stringify({
            url: targetUrl,
            method: 'GET',
            headers: { 
                'User-Agent': config.userAgent || 'Mozilla/5.0 (Linux; Android 10)' 
            },
            pluginId: PLUGIN_CONFIG.id,
            phoneRequestId: requestId,
            successMarker: successMarker,
            strategy: config.strategy || 'direct'
        }));
    }

    // --- 区域 5: 响应与正则 ---
    function handleResponse(response) {
        let final = response;
        if (typeof response === 'string') {
            try { final = JSON.parse(response); } catch(e) {}
        }
        
        const requestId = final.requestId || final.phoneRequestId;

        if (!final.success && final.status !== 200) {
            sendPluginResult({ requestId, success: false, error: final.error });
            return;
        }

        const html = final.responseText || "";
        const config = (scope.plugin && scope.plugin[PLUGIN_CONFIG.id].config) || {};
        const regexStr = config.label_regex;

        let sourceLabel = "";
        let hasContent = false;

        if (regexStr) {
            try {
                const regex = new RegExp(regexStr, 'i');
                const match = html.match(regex);
                if (match) {
                    sourceLabel = (match[1] || match[0]).trim();
                    hasContent = true;
                }
            } catch(e) {
                logError("Regex Error: " + e.message);
            }
        }

        const cleanStr = (s) => (s || '').replace(/[\u00a0\s]+/g, ' ').trim().toLowerCase();
        const lowerLabel = cleanStr(sourceLabel);
        let predefinedLabel = 'Unknown';
        for (const key in manualMapping) {
            if (cleanStr(key) === lowerLabel) {
                predefinedLabel = manualMapping[key];
                break;
            }
        }
        if (predefinedLabel === 'Unknown') {
            const match = predefinedLabels.find(l => cleanStr(l.label) === lowerLabel);
            if (match) predefinedLabel = match.label;
        }

        const checkStr = (sourceLabel + " " + predefinedLabel).toLowerCase();
        let action = 'none';
        if (blockKeywords.some(k => checkStr.includes(k.toLowerCase()))) action = 'block';
        else if (allowKeywords.some(k => checkStr.includes(k.toLowerCase()))) action = 'allow';

        sendPluginResult({
            requestId,
            success: hasContent,
            source: PLUGIN_CONFIG.name,
            sourceLabel: sourceLabel || "No Match",
            predefinedLabel: predefinedLabel,
            action: action
        });
    }

    // --- 区域 6: 初始化 ---
    function generateOutput(phone, national, e164, reqId) {
        if (phone) initiateQuery(phone, reqId);
        else sendPluginResult({ requestId: reqId, success: false, error: "No Number" });
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
