// [slicklyJP.js] - Slick.ly JP Plugin (Pure FlutterJS Regex V6.2)
// =======================================================================================
// Architecture: Native Channel (httpFetch) + Regex Parsing
// No DOM/Iframe dependencies.
// =======================================================================================

(function (scope) {
    // --- Plugin Configuration ---
    const PLUGIN_CONFIG = {
        id: 'slicklyJpPhoneNumberPlugin',
        name: 'Slick.ly JP (Regex)',
        version: '6.2.1',
        description: 'Queries Slick.ly (JP) for phone number information using Regex.',
        config: {
            strategy: 'direct',
            successMarker: "slickly",
            countryCode: "jp"
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
        '疑わしい': 'Spam Likely', '危険な': 'Risk', '安全': 'Other',
        '詐欺': 'Fraud Scam Likely', 'フィッシング詐欺': 'Fraud Scam Likely', 'スパム': 'Spam Likely',
        '嫌がらせ': 'Spam Likely', 'テレマーケティング': 'Telemarketing', 'ロボコール': 'Robocall',
        '配送': 'Delivery', '出前': 'Takeaway', 'ライドシェア': 'Ridesharing',
        '保険': 'Insurance', 'ローン': 'Loan', 'カスタマーサービス': 'Customer Service',
        '不明': 'Unknown', '金融': 'Financial', '銀行': 'Bank', '教育': 'Education',
        '医療': 'Medical', '慈善': 'Charity', 'その他': 'Other',
        '借金取り立て': 'Debt Collection', '調査': 'Survey', '政治': 'Political',
        'Eコマース': 'Ecommerce', 'リスク': 'Risk', 'エージェント': 'Agent',
        'リクルーター': 'Recruiter', 'ヘッドハンター': 'Headhunter',
        '無音電話': 'Silent Call Voice Clone', 'インターネット': 'Internet',
        '旅行・チケット': 'Travel Ticketing', 'アプリケーションソフト': 'Application Software',
        'エンターテイメント': 'Entertainment', '政府': 'Government',
        '地域サービス': 'Local Services', '自動車産業': 'Automotive Industry',
        'レンタカー': 'Car Rental', '電気通信': 'Telecommunication',
        '迷惑電話': 'Spam Likely', 'オレオレ詐欺': 'Fraud Scam Likely',
        '還付金詐欺': 'Fraud Scam Likely', '架空請求詐欺': 'Fraud Scam Likely',
        'ワンクリック詐欺': 'Fraud Scam Likely', '個人情報': 'Risk',
        '登録料': 'Fraud Scam Likely', '当選しました': 'Fraud Scam Likely',
        '未納料金': 'Debt Collection', '不審な電話': 'Spam Likely',
        '怪しい電話': 'Spam Likely', '詐欺注意': 'Fraud Scam Likely',
        '無言電話': 'Silent Call Voice Clone', '危険番号': 'Risk'
    };

    const blockKeywords = [
        '詐欺', '嫌がらせ', '迷惑', '不審', '怪しい', '借金', 'リスク', '危険番号',
        'Fraud', 'Scam', 'Spam', 'Risk'
    ];
    const allowKeywords = [
        '配送', '出前', 'ライドシェア', '安全', 'カスタマーサービス'
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
        const countryCode = config.countryCode || "jp";
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
            const countRegex = /(?:註釋|注释|Comments|口コミ)\s*\((\d+)\)/i;
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
                if (['疑わしい', 'リスク', '危険な', '怪しい', '不審'].includes(parsed.summaryLabel)) action = 'block';
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
