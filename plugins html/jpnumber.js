// [jpnumber.js] - Telnavi/Jpnumber Plugin (Pure FlutterJS Regex V6.1)
// =======================================================================================
// Architecture: Native Channel (httpFetch) + Regex Parsing
// No DOM/Iframe dependencies.
// =======================================================================================

(function (scope) {
    // --- Plugin Configuration ---
    const PLUGIN_CONFIG = {
        id: 'telnaviPlugin', // Preserved from original
        name: 'Telnavi (jpnumber) (Regex)',
        version: '6.1.1',
        description: 'Queries jpnumber.com for phone number information using Regex.',
        config: {
            strategy: 'direct',
            successMarker: "jpnumber",
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
        '迷惑電話': 'Spam Likely', '注意': 'Spam Likely', '安全': 'Other', '安全(推測)': 'Other',
        '不明': 'Unknown', '営業': 'Telemarketing', 'いたずら': 'Spam Likely', 'ワン切り': 'Spam Likely',
        '架空請求': 'Fraud Scam Likely', '勧誘': 'Telemarketing', '取り立て': 'Debt Collection',
        '詐欺': 'Fraud Scam Likely', '融资保证金诈欺': 'Fraud Scam Likely', 'ヤミ金': 'Fraud Scam Likely',
        '選挙': 'Political', '世論調査': 'Survey', '督促': 'Debt Collection', '配送': 'Delivery',
        '役所': 'Government', '病院': 'Medical', '学校': 'Education', '銀行': 'Bank',
        'カード': 'Financial', '保険': 'Insurance', '不动产': 'Telemarketing', 'リサイクル': 'Telemarketing',
        '廃品回収': 'Telemarketing', '家庭教師': 'Telemarketing', '塾': 'Education', '通信販売': 'Ecommerce',
        '飲食店': 'Other', '宿泊施設': 'Other', '美容': 'Other', '医疗': 'Medical',
        '介護': 'Medical', '公共施設': 'Government', '警察': 'Government', '消防': 'Government',
        '弁护士': 'Other', '司法書士': 'Other', '行政書士': 'Other', '会計士': 'Other',
        '税理士': 'Other', '社労士': 'Other', '探偵': 'Other', '便利屋': 'Other',
        '代行': 'Other', '修理': 'Other', '清掃': 'Other', '運送': 'Delivery',
        '引越し': 'Delivery', 'タクシー': 'Ridesharing', '運転代行': 'Ridesharing', 'レンタカー': 'Car Rental',
        '旅行': 'Travel Ticketing', 'ホテル': 'Other', '旅館': 'Other', '民宿': 'Other',
        'ペンション': 'Other', 'キャンプ場': 'Other', '温泉': 'Other', '銭湯': 'Other',
        'サウナ': 'Other', 'エステ': 'Other', 'マッサージ': 'Other', 'ネイル': 'Other',
        'まつげ': 'Other', 'ヘアサロン': 'Other', 'ペット': 'Other', '动物病院': 'Medical',
        'ペットショップ': 'Other', 'トリミング': 'Other', 'ペットホテル': 'Other', 'しつけ': 'Other',
        'ブリーダー': 'Other', '里親': 'Other', '保护': 'Other', 'ボランティア': 'Charity'
    };

    const blockKeywords = ['迷惑電話', '注意', 'いたずら', 'ワン切り', '架空請求', '勧誘', '取り立て', '詐欺', 'ヤミ金', 'Spam', 'Fraud'];
    const allowKeywords = ['安全', '配送', '役所', '病院', '学校', '銀行', '公共施設', '警察', '消防', '運送', '引越し', 'Delivery', 'Medical', 'Government'];

    // --- Helpers ---
    function log(message) { if (typeof sendMessage === 'function') sendMessage('Log', JSON.stringify(`[${PLUGIN_CONFIG.id}] ${message}`)); }
    function logError(message) { if (typeof sendMessage === 'function') sendMessage('Log', JSON.stringify(`[${PLUGIN_CONFIG.id}] [ERROR] ${message}`)); }
    
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
        const successMarker = config.successMarker || "jpnumber"; 

        const targetUrl = `https://www.jpnumber.com/searchnumber.do?number=${phoneNumber}`;
        // [Fix] Use Android UA consistent with successful fetch in ztest
        const userAgent = config.userAgent || 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

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
            logError("httpFetch failed: " + e.message);
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
            // 1. Name/Title Extraction
            // Robust version: matches title-text12 (often used for reviews) OR business name in table
            const titleRegex = /<span\s+class=["']title-text(12|15)["'][\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i;
            const businessReTable = /(?:事業者|Business name|business operator)[\s\S]*?<td[^>]*>([\s\S]*?)(?:<\/td>|<a)/i;
            
            const titleMatch = html.match(titleRegex);
            const businessMatch = html.match(businessReTable);

            if (businessMatch) {
                const rawName = businessMatch[1].replace(/<[^>]+>/g, '').trim();
                if (rawName && !/^(---|-|未登録|頭番号|Head Number)$/i.test(rawName)) {
                    result.name = rawName;
                    result.success = true;
                }
            }
            
            if (!result.name && titleMatch) {
                const fullTitle = titleMatch[2].replace(/<[^>]+>/g, '').trim();
                const parts = fullTitle.split('|');
                if (parts.length > 0) {
                    const potentialName = parts[0].trim();
                    if (potentialName && !/^(口コミ|頭番号|Head Number|電話番号)/i.test(potentialName)) {
                        result.name = potentialName;
                        result.success = true;
                    }
                }
            }

            // 2. Count Extraction (Accesses or Reviews)
            const countRegex = /(?:口コミ数|Number of reviews|アクセス回数|Number of accesses)[\s\S]*?<span\s+class=["'](?:orange|red)["'][^>]*>(\d+)<\/span>/i;
            const accessRegexTd = /(?:アクセス回数|Number of accesses)[\s\S]*?<td\s+class=["']red["'][^>]*>(\d+)<\/td>/i;
            
            const countMatch = html.match(countRegex) || html.match(accessRegexTd);
            if (countMatch) {
                result.count = parseInt(countMatch[1], 10);
                if (result.count > 0) result.success = true;
            }

            // 3. Label/Keyword Extraction (Scan entire HTML including comments)
            for (const key in manualMapping) {
                if (html.indexOf(key) !== -1) {
                    if (!result.sourceLabel) result.sourceLabel = key;
                    result.predefinedLabel = manualMapping[key];
                    result.success = true; // Finding a tag/keyword in comments is a success
                    break;
                }
            }
            
            if (result.name && !result.sourceLabel) {
                 for (const key in manualMapping) {
                    if (result.name.indexOf(key) !== -1) {
                        result.sourceLabel = key;
                        result.predefinedLabel = manualMapping[key];
                        break;
                    }
                 }
            }

            return result;
        } catch (e) {
            logError("Regex Parse Error: " + e.message);
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
                 const label = parsed.predefinedLabel || parsed.sourceLabel;
                 if (label) {
                     let determinedAction = 'none';
                     for (const k of blockKeywords) { if (label.includes(k) || (parsed.sourceLabel && parsed.sourceLabel.includes(k))) { determinedAction = 'block'; break; } }
                     if (determinedAction === 'none') {
                         for (const k of allowKeywords) { if (label.includes(k) || (parsed.sourceLabel && parsed.sourceLabel.includes(k))) { determinedAction = 'allow'; break; } }
                     }
                     parsed.action = determinedAction;
                 }
            }

            parsed.requestId = requestId;
            sendPluginResult(parsed);
        } catch (e) {
            logError("Error in handleResponse: " + e.message);
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
