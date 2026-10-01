(function (scope) {
  // --- Plugin Configuration ---
  const PLUGIN_CONFIG = {
      id: 'tellowsPlugin', // Plugin ID, must be unique
      name: 'Tellows', // Plugin name
      version: '5.6.0', // Modernized with Dio/Regex
      description: 'Queries tellows.com for phone number information using direct fetch and regex parsing.',
      config: {
          strategy: 'direct',
          successMarker: "tellows"
      },
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

  // Manual mapping table to map source labels to predefined labels
  const manualMapping = {
      'Unknown': 'Unknown',
      'Trustworthy number': 'Other',
      'Sweepstakes, lottery': 'Spam Likely',
      'Debt collection company': 'Debt Collection',
      'Aggressive advertising': 'Telemarketing',
      'Survey': 'Survey',
      'Harassment calls': 'Spam Likely',
      'Cost trap': 'Fraud Scam Likely',
      'Telemarketer': 'Telemarketing',
      'Ping Call': 'Spam Likely',
      'SMS spam': 'Spam Likely',
      'Spam Call': 'Spam Likely',
  };

  const blockKeywords = [
      'Spam', 'Scam', 'Fraud', 'Telemarketing', 'Robocall', 'Debt', 'Risk', 'Silent', 'Nuisance', 'Harassment',
      'Prank', 'Phishing', 'Kostenfalle', 'Unseriös', 'Betrug', 'Werbeanruf', 'Telefonterror', 'Abzocke',
      'Gewinnspiel', 'Inkasso', 'Umfrage', 'Meinungsforschung', 'Callcenter', 'Ping Anruf', 'Bandansage',
      'Gefährlich', 'Verdächtig', 'Molesto', 'Publicidad', 'Cobranza', 'Acoso', 'Estafa', 'Fraude'
  ];
  const allowKeywords = [
      'Delivery', 'Takeaway', 'Insurance', 'Customer Service', 'Bank', 'Medical', 'Charity', 'Trusted', 'Safe',
      'Confirmation', 'Zustellung', 'Versicherung', 'Spenden', 'Service', 'Termin', 'Bestellung', 'Lieferung',
      'Kundenbetreuung', 'Fiable', 'Entrega', 'Positivo'
  ];

  // --- Constants and State ---
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
   * 【V5.6.0 逻辑升级】 Optimized for Regex parsing.
   */
  function parseHTML(html, phoneNumber) {
      const result = {
          count: 0, sourceLabel: "", province: "", city: "", carrier: "",
          phoneNumber: phoneNumber, name: "unknown", action: 'none',
          predefinedLabel: 'Unknown', success: false, error: '',
          source: PLUGIN_CONFIG.name, numbers: []
      };

      if (!html) return result;

      try {
          // 1. Label Extraction
          const labelRegex = /Types\s+of\s+call:<\/b>\s*([^<]+)/i;
          const labelMatch = html.match(labelRegex);
          if (labelMatch) {
              result.sourceLabel = labelMatch[1].trim();
          }

          // Fallback Label: Score Image
          if (!result.sourceLabel) {
              const scoreRegex = /img[^>]*class=["']scoreimage["'][^>]*alt=["']Scores([789])["']/i;
              if (html.match(scoreRegex)) {
                  result.sourceLabel = "Spam Call";
              }
          }

          // 2. Name Extraction
          const nameRegex = /class=["']callerId["'][^>]*>([\s\S]*?)<\/span>/i;
          const nameMatch = html.match(nameRegex);
          if (nameMatch) {
              result.name = nameMatch[1].replace(/<[^>]+>/g, '').trim();
          }

          // 3. Count (Ratings)
          const countRegex = /Ratings:<\/strong>\s*<span[^>]*>(\d+)<\/span>/i;
          const countMatch = html.match(countRegex);
          if (countMatch) {
              result.count = parseInt(countMatch[1]);
          }

          // 4. City & Province
          const cityRegex = /City:<\/strong>\s*([^<]+)/i;
          const cityMatch = html.match(cityRegex);
          if (cityMatch) {
              const cityText = cityMatch[1].trim();
              const parts = cityText.split('-');
              if (parts.length > 0) {
                  result.city = parts[0].trim();
                  if (parts.length > 1) {
                      result.province = parts.slice(1).join('-').trim();
                  }
              }
          }

          // 5. Mapping & Success (Latin Fuzzy Substring Matching)
          if (result.sourceLabel) {
            const lowerLabel = (result.sourceLabel || '').toLowerCase();
            let matchedLabel = 'Unknown';
            for (const key in manualMapping) {
                if (lowerLabel.includes(key.toLowerCase())) {
                    matchedLabel = manualMapping[key];
                    break;
                }
            }
            if (matchedLabel === 'Unknown') {
                const match = predefinedLabels.find(l => lowerLabel.includes(l.label.toLowerCase()));
                if (match) matchedLabel = match.label;
            }
            result.predefinedLabel = matchedLabel;
          }
          
          result.success = result.sourceLabel !== "" || result.count > 0 || result.name !== "unknown";

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
          const targetSearchUrl = `https://www.tellows.com/num/${encodeURIComponent(phoneNumber)}`;
          const config = (scope.plugin && scope.plugin[PLUGIN_CONFIG.id] && scope.plugin[PLUGIN_CONFIG.id].config) || {};
          const userAgent = config.userAgent || 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

          sendMessage('httpFetch', JSON.stringify({
              url: targetSearchUrl,
              method: 'GET',
              headers: { 'User-Agent': userAgent },
              pluginId: PLUGIN_CONFIG.id,
              phoneRequestId: requestId
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

          if (parsed.success) {
              const checkStr = (parsed.sourceLabel + " " + (parsed.predefinedLabel || '')).toLowerCase();
              let determinedAction = 'none';
              for (const k of blockKeywords) { if (checkStr.includes(k.toLowerCase())) { determinedAction = 'block'; break; } }
              if (determinedAction === 'none') {
                  for (const k of allowKeywords) { if (checkStr.includes(k.toLowerCase())) { determinedAction = 'allow'; break; } }
              }
              parsed.action = determinedAction;
          }
                  parsed.action = determinedAction;
              }
          }

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