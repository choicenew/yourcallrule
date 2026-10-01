(function (scope) {
    // --- Plugin Configuration ---
    const PLUGIN_CONFIG = {
        id: 'jpnumberPlugin',
        name: 'JPNumber Lookup (Regex)',
        version: '1.1.1', // Modernized with Dio/Regex
        description: 'Queries jpnumber.com for phone number information using direct fetch and regex parsing.',
        config: {
            strategy: 'direct',
            successMarker: "jpnumber"
        },
    };

    // --- Predefined Labels ---
    const predefinedLabels = [
        { label: 'Fraud Scam Likely' }, { label: 'Spam Likely' }, { label: 'Telemarketing' },
        { label: 'Robocall' }, { label: 'Delivery' }, { label: 'Takeaway' },
        { label: 'Ridesharing' }, { label: 'Insurance' }, { label: 'Loan' },
        { label: 'Customer Service' }, { label: 'Unknown' }, { label: 'Financial' },
        { label: 'Bank' }, { label: 'Education' }, { label: 'Medical' },
        { label: 'Charity' }, { label: 'Other' }, { label: 'Debt Collection' },
        { label: 'Survey' }, { label: 'Political' }, { label: 'Ecommerce' },
        { label: 'Risk' }, { label: 'Agent' }, { label: 'Recruiter' },
        { label: 'Headhunter' }, { label: 'Silent Call Voice Clone' }, { label: 'Internet' },
        { label: 'Travel Ticketing' }, { label: 'Application Software' }, { label: 'Entertainment' },
        { label: 'Government' }, { label: 'Local Services' }, { label: 'Automotive Industry' },
        { label: 'Car Rental' }, { label: 'Telecommunication' },
    ];

    // --- Manual Mapping ---
    const manualMapping = {
        '疑わしい': 'Spam Likely', '危険な': 'Risk', '詐欺': 'Fraud Scam Likely',
        'フィッシング詐欺': 'Fraud Scam Likely', 'スパム': 'Spam Likely', '嫌がらせ': 'Spam Likely',
        'テレマーケティング': 'Telemarketing', 'ロボコール': 'Robocall', '配送': 'Delivery',
        '出前': 'Takeaway', 'ライドシェア': 'Ridesharing', '保険': 'Insurance',
        'ローン': 'Loan', 'カスタマーサービス': 'Customer Service', '不明': 'Unknown',
        '金融': 'Financial', '銀行': 'Bank', '教育': 'Education', '医療': 'Medical',
        '慈善': 'Charity', 'その他': 'Other', '借金取り立て': 'Debt Collection',
        '調査': 'Survey', '政治': 'Political', 'Eコマース': 'Ecommerce',
        'リスク': 'Risk', 'エージェント': 'Agent', 'リクルーター': 'Recruiter',
        'ヘッドハンター': 'Headhunter', '無音電話': 'Silent Call Voice Clone', 'インターネット': 'Internet',
        '旅行・チケット': 'Travel Ticketing', 'アプリケーションソフト': 'Application Software',
        'エンターテイメント': 'Entertainment', '政府': 'Government', '地域サービス': 'Local Services',
        '自動車産業': 'Automotive Industry', 'レンタカー': 'Car Rental', '電気通信': 'Telecommunication',
        '迷惑電話': 'Spam Likely', '電力会社なりすまし詐欺': 'Fraud Scam Likely', '危険番号': 'Risk',
        'オレオレ詐欺': 'Fraud Scam Likely', '還付金詐欺': 'Fraud Scam Likely',
        '架空請求詐欺': 'Fraud Scam Likely', 'ワンクリック詐欺': 'Fraud Scam Likely',
        '不審な電話': 'Spam Likely', '怪しい電話': 'Spam Likely', '詐欺注意': 'Fraud Scam Likely',
        '無言電話': 'Silent Call Voice Clone', '勧誘/営業/案内': 'Telemarketing',
        '詐欺 / 犯罪の匂い': 'Fraud Scam Likely', 'その他の迷惑': 'Spam Likely',
        '安全 / (迷惑ではない)': 'Other'
    };

    const blockKeywords = ['詐欺', '迷惑', 'スパム', '嫌がらせ', '危険', '悪質', 'Scam', 'Fraud'];
    const allowKeywords = ['配送', '出前', '安全'];

    // --- Logging and Communication functions ---
    // [Modernized] Removed Iframe proxy logic.

    function log(message) { if (typeof sendMessage === 'function') sendMessage('Log', JSON.stringify(`[${PLUGIN_CONFIG.id}] ${message}`)); }
    function logError(message, error) { if (typeof sendMessage === 'function') sendMessage('Log', JSON.stringify(`[${PLUGIN_CONFIG.id}] [ERROR] ${message} ${error ? error.toString() : ''}`)); }

    function sendPluginResult(result) {
        log(`Sending final result to Flutter: ${JSON.stringify(result)}`);
        if (typeof sendMessage === 'function') {
            sendMessage('PluginResultChannel', JSON.stringify(result));
        } else if (scope.flutter_inappwebview && scope.flutter_inappwebview.callHandler) {
            scope.flutter_inappwebview.callHandler('PluginResultChannel', JSON.stringify(result));
        }
    }

    function sendPluginLoaded() {
        log('Plugin loaded, notifying Flutter.');
        if (typeof sendMessage === 'function') {
            sendMessage('TestPageChannel', JSON.stringify({ type: 'pluginLoaded', pluginId: PLUGIN_CONFIG.id, version: PLUGIN_CONFIG.version }));
        } else if (scope.flutter_inappwebview && scope.flutter_inappwebview.callHandler) {
            scope.flutter_inappwebview.callHandler('TestPageChannel', JSON.stringify({ type: 'pluginLoaded', pluginId: PLUGIN_CONFIG.id, version: PLUGIN_CONFIG.version }));
        }
    }

    /**
     * 【V1.1.0 逻辑升级】 Regex-based parsing for jpnumber.com.
     */
    function parseHTML(html, phoneNumber) {
        const result = {
            phoneNumber: phoneNumber, sourceLabel: '', count: 0, province: '', city: '', carrier: '',
            name: '', predefinedLabel: 'Unknown', source: PLUGIN_CONFIG.name, numbers: [], success: false, error: '', action: 'none'
        };

        if (!html) return result;

        try {
            // 1. Name Extraction
            const titleRegex = /class=["']title-text12["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i;
            const titleMatch = html.match(titleRegex);
            if (titleMatch) {
                const parts = titleMatch[1].split('|');
                result.name = parts[0].trim();
                result.success = true;
            }

            // 2. Count Extraction
            const countRegex = /口コミ数:<span\s+class=["']orange["']>(\d+)<\/span>/i;
            const countMatch = html.match(countRegex);
            if (countMatch) {
                result.count = parseInt(countMatch[1]);
                result.success = true;
            }

            // 3. Keyword Extraction for sourceLabel
            for (const key in manualMapping) {
                if (html.includes(key)) {
                    result.sourceLabel = key;
                    result.predefinedLabel = manualMapping[key];
                    break;
                }
            }

            // [Action Logic]
            if (result.success) {
                const checkStr = (result.name + " " + result.sourceLabel);
                if (blockKeywords.some(k => checkStr.includes(k))) result.action = 'block';
                else if (allowKeywords.some(k => checkStr.includes(k))) result.action = 'allow';
            }

            return result;
        } catch (e) {
            logError("Regex Parse Error", e);
            result.error = e.toString();
            return result;
        }
    }

    function initiateQuery(phoneNumber, requestId) {
        log(`Initiating query for '${phoneNumber}' (requestId: ${requestId})`);
        try {
            const targetSearchUrl = `https://www.jpnumber.com/searchnumber.do?number=${encodeURIComponent(phoneNumber)}`;
            const config = (scope.plugin && scope.plugin[PLUGIN_CONFIG.id] && scope.plugin[PLUGIN_CONFIG.id].config) || {};
            const userAgent = config.userAgent || 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

            sendMessage('httpFetch', JSON.stringify({
                url: targetSearchUrl,
                method: 'GET',
                headers: { 'User-Agent': userAgent },
                pluginId: PLUGIN_CONFIG.id,
                phoneRequestId: requestId,
                strategy: config.strategy || 'direct'
            }));
        } catch (error) {
            logError(`Error in initiateQuery for requestId ${requestId}:`, error);
            sendPluginResult({ requestId, success: false, error: `Query initiation failed: ${error.message}` });
        }
    }

    function handleResponse(response) {
        log("handleResponse called.");
        try {
            let final = response;
            if (typeof response === 'string') {
                try { final = JSON.parse(response); } catch (e) { }
            }

            const requestId = final.requestId || final.phoneRequestId;
            if (!final.success) {
                sendPluginResult({ requestId, success: false, error: final.error || "HTTP Error" });
                return;
            }

            const html = final.responseText || "";
            const parsed = parseHTML(html, final.phoneNumber || "");

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
            sendPluginResult({ requestId, success: false, error: 'No valid phone number provided.' });
        }
    }

    function initialize() {
        if (scope.plugin && scope.plugin[PLUGIN_CONFIG.id]) {
            log('Plugin already initialized.');
            return;
        }
        if (!scope.plugin) {
            scope.plugin = {};
        }
        scope.plugin[PLUGIN_CONFIG.id] = {
            info: PLUGIN_CONFIG,
            generateOutput: generateOutput,
            handleResponse: handleResponse,
            config: {}
        };
        log(`Plugin registered: scope.plugin.${PLUGIN_CONFIG.id}`);
        sendPluginLoaded();
    }

    initialize();

})(globalThis);
