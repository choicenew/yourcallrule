(function (scope) {
  // --- Plugin Configuration ---
  const PLUGIN_CONFIG = {
      id: 'shouldianswerPlugin',
      name: 'Should I Answer (Regex)',
      version: '1.3.1', // Modernized with Dio/Regex
      description: 'Queries shouldianswer.com for phone number information using direct fetch and regex parsing.',
      config: {
          strategy: 'direct',
          successMarker: "shouldianswer"
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

  const manualMapping = {
      'Telemarketer': 'Telemarketing', 'Call centre': 'Customer Service',
      'Financial services': 'Financial', 'Debt collector': 'Debt Collection',
      'Company': 'Other', 'Service': 'Customer Service',
      'Non-profit Organization': 'Charity', 'Survey': 'Survey',
      'Nuisance call': 'Spam Likely', 'Unsolicited call': 'Spam Likely',
      'Political call': 'Political', 'Scam call': 'Fraud Scam Likely',
      'Prank call': 'Spam Likely', 'Other': 'Other',
      'NEGATIVE TELEMARKETER': 'Telemarketing', 'Unknown': 'Unknown',
      'TELEMARKETER': 'Telemarketing', 'CALL CENTRE': 'Customer Service',
      'FINANCIAL SERVICES': 'Financial', 'DEBT COLLECTOR': 'Debt Collection',
      'COMPANY': 'Other', 'SERVICE': 'Customer Service',
      'NON-PROFIT ORGANIZATION': 'Charity', 'SURVEY': 'Survey',
      'NUISANCE CALL': 'Spam Likely', 'UNSOLICITED CALL': 'Spam Likely',
      'POLITICAL CALL': 'Political', 'SCAM CALL': 'Fraud Scam Likely',
      'PRANK CALL': 'Spam Likely', 'OTHER': 'Other',
      'SILENT CALL': 'Silent Call Voice Clone',
      'SILENT CALL': 'Silent Call Voice Clone',
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

  function log(message) { console.log(`[${PLUGIN_CONFIG.id} v${PLUGIN_CONFIG.version}] ${message}`); }
  function logError(message, error) { console.error(`[${PLUGIN_CONFIG.id} v${PLUGIN_CONFIG.version}] ${message}`, error); }

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
   * 【V1.3.0 逻辑升级】 Regex-based parsing for shouldianswer.com.
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
          const labelRegex = /class=["']number["'][^>]*>[\s\S]*?<span[^>]*style=["']color:#000["'][^>]*>([\s\S]*?)<\/span>/i;
          const labelMatch = html.match(labelRegex);
          if (labelMatch) {
              let labelText = labelMatch[1].replace(/<[^>]+>/g, '').trim();
              result.sourceLabel = labelText.replace(/^(POSITIVE|NEGATIVE|NEUTRAL)\s*/i, '').trim();
              result.success = true;
          }

          // 2. Count Extraction
          const countRegex = /class=["']infox["'][^>]*>([\s\S]*?)<\/div>/i;
          const countMatch = html.match(countRegex);
          if (countMatch) {
              const text = countMatch[1];
              if (text.includes('Single user')) {
                  result.count = 1;
              } else {
                  const m = text.match(/<strong>\s*(\d+)\s*<\/strong>/i);
                  // Pattern search for second strong usually
                  const allStrongs = text.match(/<strong>\s*(\d+)\s*<\/strong>/gi);
                  if (allStrongs && allStrongs.length >= 2) {
                      result.count = parseInt(allStrongs[1].replace(/<[^>]+>/g, ''));
                  } else if (m) {
                      result.count = parseInt(m[1]);
                  }
              }
              if (result.count > 0) result.success = true;
          }

          // 3. City Extraction
          const cityRegex = /class=["']number["'][^>]*>[\s\S]*?<span[^>]*>([^<,]+,[^<]+)<\/span>/i;
          const cityMatch = html.match(cityRegex);
          if (cityMatch) {
              const parts = cityMatch[1].split(',');
              result.city = parts[parts.length - 1].trim();
          }

          // 4. Mapping (Latin Fuzzy Substring Matching)
          if (result.sourceLabel) {
              const lowerLabel = result.sourceLabel.toLowerCase();
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
          const targetSearchUrl = `https://www.shouldianswer.com/phone-number/${encodeURIComponent(phoneNumber)}`;
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

          parsed.requestId = requestId;
          if (parsed.success) {
              const checkStr = (parsed.sourceLabel + " " + (parsed.predefinedLabel || '')).toLowerCase();
              let determinedAction = 'none';
              for (const k of blockKeywords) { if (checkStr.includes(k.toLowerCase())) { determinedAction = 'block'; break; } }
              if (determinedAction === 'none') {
                  for (const k of allowKeywords) { if (checkStr.includes(k.toLowerCase())) { determinedAction = 'allow'; break; } }
              }
              parsed.action = determinedAction;
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