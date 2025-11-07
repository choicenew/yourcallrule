import 'dart:convert';


import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:args/command_runner.dart';
import 'package:path/path.dart' as p;
import 'package:yaml/yaml.dart';

// 定义每个翻译区块包含的条目数量
const int chunkSize = 100;
// 定义用于暂存文件的缓存目录名称
const String cacheDirName = ".translate_cache";

/// 一个命令行工具，用于使用可插拔的 AI 提供商翻译 Flutter ARB 本地化文件。
class TranslateCommand extends Command {
  @override
  final name = "run";
  @override
  final description = "使用可配置的 API 提供商 (Google/OpenRouter) 翻译 ARB 文件。";

  TranslateCommand() {
    argParser
      ..addOption(
        'target-langs',
        abbr: 't',
        help: '必须指定的目标语言代码，用逗号分隔 (例如: es,de,fr,ja)',
        mandatory: true,
      )
      ..addFlag('no-cache',
          negatable: false, help: '强制清除缓存并重新翻译所有内容。');
  }

  @override
  Future<void> run() async {
    // 步骤 1: 加载所有配置
    final config = _loadConfig();
    // 经过修正的 _loadConfig 现在返回的是纯净的 Map，这里可以安全地进行类型转换
    final providerConfig =
        config['translation-provider'] as Map<String, dynamic>;
    final providerName = providerConfig['name'] as String;
    final arbDir = config['arb-dir'] as String;
    final templateArbFile = config['template-arb-file'] as String;
    final useCache = !(argResults!['no-cache'] as bool);

    // 步骤 2: 准备源文件和缓存目录
    final sourceMessages = _loadSourceMessages(arbDir, templateArbFile);
    final cacheDir = Directory(cacheDirName);
    if (!await cacheDir.exists()) await cacheDir.create();
    if (!useCache) {
      print("提示：检测到 --no-cache 参数，正在清空缓存...");
      await cacheDir.delete(recursive: true);
      await cacheDir.create();
    }

    // 步骤 3: 循环处理每种目标语言
    final targetLangs = (argResults!['target-langs'] as String)
        .split(',')
        .map((e) => e.trim())
        .where((e) => e.isNotEmpty)
        .toList();

    print("准备翻译以下语言: ${targetLangs.join(', ')} (使用提供商: $providerName)");
    print("-" * 30);

    for (final lang in targetLangs) {
      await _translateLanguage(
          lang, arbDir, sourceMessages, providerConfig, cacheDir);
      print("-" * 30);
    }
    print("所有翻译任务已完成！");
  }

  // --- (其他函数与上一版相同，为保持完整性全部列出) ---

  /// 处理单一语言的完整翻译流程。
  Future<void> _translateLanguage(
    String targetLang,
    String arbDir,
    Map<String, dynamic> sourceMessages,
    Map<String, dynamic> providerConfig,
    Directory cacheDir,
  ) async {
    print("开始处理语言: '$targetLang'");
    final targetArbPath = p.join(arbDir, 'app_$targetLang.arb');
    final targetFile = File(targetArbPath);
    Map<String, dynamic> targetMessages = {};
    if (await targetFile.exists()) {
      targetMessages =
          jsonDecode(await targetFile.readAsString()) as Map<String, dynamic>;
    } else {
      print("提示：目标文件 '$targetArbPath' 不存在，将创建一个新文件。");
    }

    final messagesToTranslate = <String, dynamic>{};
    for (final entry in sourceMessages.entries) {
      if (!entry.key.startsWith('@') &&
          !targetMessages.containsKey(entry.key)) {
        messagesToTranslate[entry.key] = entry.value;
      }
    }

    if (messagesToTranslate.isEmpty) {
      print("🎉 语言 '$targetLang' 的文件已是最新，无需翻译。");
      return;
    }
    print("发现 ${messagesToTranslate.length} 条内容需要翻译为 '$targetLang'。");
    final chunks = _createChunks(messagesToTranslate, chunkSize);
    final chunkFiles = <File>[];
    for (int i = 0; i < chunks.length; i++) {
      final chunkFile =
          File(p.join(cacheDir.path, '${targetLang}_chunk_$i.json'));
      await chunkFile.writeAsString(jsonEncode(chunks[i]));
      chunkFiles.add(chunkFile);
    }
    print("已将翻译任务物化为 ${chunkFiles.length} 个区块暂存文件。");
    for (int i = 0; i < chunkFiles.length; i++) {
      final chunkFile = chunkFiles[i];
      final translatedFile = File(
          p.join(cacheDir.path, '${targetLang}_chunk_${i}_translated.json'));
      if (await translatedFile.exists()) {
        print("✅ 区块 ${i + 1} 已翻译 (从缓存加载)，跳过。");
        continue;
      }
      print("正在翻译区块 ${i + 1} / ${chunkFiles.length}...");
      try {
        final chunkContent =
            jsonDecode(await chunkFile.readAsString()) as Map<String, dynamic>;
        final translatedContent =
            await _translateChunk(chunkContent, targetLang, providerConfig);
        await translatedFile.writeAsString(
            const JsonEncoder.withIndent('  ').convert(translatedContent));
        print("✅ 区块 ${i + 1} 翻译成功并已暂存。");
      } catch (e) {
        stderr.writeln("❌ 区块 ${i + 1} 翻译失败: $e");
        stderr.writeln("任务中断。下次运行时将从此区块继续。");
        return;
      }
      if (chunkFiles.length > 1) {
        await Future.delayed(const Duration(seconds: 4));
      }
    }

    print("所有区块翻译完成，正在从暂存文件合并结果...");
    final allTranslatedMessages = <String, dynamic>{};
    for (int i = 0; i < chunkFiles.length; i++) {
      final translatedFile = File(
          p.join(cacheDir.path, '${targetLang}_chunk_${i}_translated.json'));
      final content =
          jsonDecode(await translatedFile.readAsString()) as Map<String, dynamic>;
      allTranslatedMessages.addAll(content);
    }
    final newContent = {...targetMessages, ...allTranslatedMessages};
    final sortedContent = _sortContent(newContent, sourceMessages);
    await targetFile.writeAsString(
        const JsonEncoder.withIndent('  ').convert(sortedContent));
    print(
        "✅ 成功更新 '$targetArbPath'，新增 ${allTranslatedMessages.length} 条翻译。");
    print("正在清理 '$targetLang' 的暂存文件...");
    for (int i = 0; i < chunkFiles.length; i++) {
      await chunkFiles[i].delete();
      final translatedFile = File(
          p.join(cacheDir.path, '${targetLang}_chunk_${i}_translated.json'));
      if (await translatedFile.exists()) await translatedFile.delete();
    }
    print("清理完成。");
  }

  /// “总接口”函数。它像一个开关，根据配置决定调用哪个具体的翻译函数。
  Future<Map<String, dynamic>> _translateChunk(Map<String, dynamic> chunk,
      String targetLang, Map<String, dynamic> providerConfig) {
    final providerName = providerConfig['name'] as String;
    switch (providerName) {
      case 'google':
        print("(使用 Google API)");
        return _translateWithGoogle(chunk, targetLang, providerConfig);
      case 'openrouter':
        print("(使用 OpenRouter API)");
        return _translateWithOpenRouter(chunk, targetLang, providerConfig);
      default:
        throw Exception("不支持的翻译提供商: $providerName. 请检查 l10n.yaml 中的配置。");
    }
  }

  /// “OpenRouter App”的实现：调用 OpenRouter API。
  Future<Map<String, dynamic>> _translateWithOpenRouter(
      Map<String, dynamic> chunk,
      String targetLang,
      Map<String, dynamic> providerConfig) async {
    final apiKey = providerConfig['api-key'] as String;
    final model = providerConfig['model'] as String;
    final baseUrl = providerConfig['base-url'] as String;
    final extraHeaders =
        providerConfig['extra-headers'] as Map<String, dynamic>? ?? {};

    final prompt = _buildPrompt(targetLang, chunk);
    final url = Uri.parse(p.join(baseUrl, 'chat/completions'));

    final headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $apiKey',
      ...extraHeaders.map((key, value) => MapEntry(key, value.toString())),
    };

    final body = jsonEncode({
      'model': model,
      'messages': [
        {'role': 'user', 'content': prompt}
      ],
      'response_format': {'type': 'json_object'},
    });

    final response = await http.post(url, headers: headers, body: body);

    if (response.statusCode == 200) {
      final responseBody = jsonDecode(utf8.decode(response.bodyBytes));
      final choices = responseBody['choices'] as List<dynamic>?;
      if (choices == null || choices.isEmpty) throw Exception("API 响应中没有有效的 'choices'。响应体: ${response.body}");
      final message = choices.first['message']['content'] as String?;
      if (message == null) throw Exception("API 响应的消息内容为空。响应体: ${response.body}");
      return jsonDecode(message) as Map<String, dynamic>;
    } else {
      throw Exception('API 调用失败，状态码 ${response.statusCode}: ${response.body}');
    }
  }

  /// “Google TV App”的实现：调用 Google 原生 API。
  Future<Map<String, dynamic>> _translateWithGoogle(
      Map<String, dynamic> chunk,
      String targetLang,
      Map<String, dynamic> providerConfig) async {
    final apiKey = providerConfig['api-key'] as String;
    final model = providerConfig['model'] as String;
    final prompt = _buildPrompt(targetLang, chunk);
    final url = Uri.parse(
        'https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=$apiKey');
    final response = await http.post(url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'contents': [
            {'parts': [{'text': prompt}]}
          ],
          "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
          ]
        }));
    if (response.statusCode == 200) {
      final responseBody = jsonDecode(utf8.decode(response.bodyBytes));
      final candidates = responseBody['candidates'] as List<dynamic>?;
      if (candidates == null || candidates.isEmpty) throw Exception("API 响应中没有有效的 'candidates'。响应体: ${response.body}");
      final parts = candidates.first['content']['parts'] as List<dynamic>?;
      if (parts == null || parts.isEmpty) throw Exception("API 响应中没有有效的 'parts'。响应体: ${response.body}");
      final rawText = parts.first['text'] as String;
      final cleanJson = rawText.replaceAll(RegExp(r"```(json)?", multiLine: true), "").trim();
      try {
        return jsonDecode(cleanJson) as Map<String, dynamic>;
      } catch (e) {
        throw Exception("无法解析来自 API 的 JSON 响应。原始文本: $cleanJson");
      }
    } else {
      throw Exception('API 调用失败，状态码 ${response.statusCode}: ${response.body}');
    }
  }

  /// 构建统一的翻译指令 (Prompt)，供所有提供商使用。
  String _buildPrompt(String targetLang, Map<String, dynamic> chunk) {
    return """
You are a professional translator for a Flutter application.
Your task is to translate the following ARB JSON content from English to the target locale '$targetLang'.

Instructions:
1.  **Crucially, the very first key-value pair in your JSON response MUST be `"@@locale": "$targetLang"`.**
2.  After the `@@locale` entry, maintain the original JSON keys for all other entries exactly as they are.
3.  Only translate the string values.
4.  For values containing placeholders (e.g., {userName}, {count}), keep the placeholders untranslated and in their original format.
5.  Your response MUST be a pure, raw, well-formatted JSON object.
6.  Do not include any extra explanations, introductory text, or markdown formatting like ```json. Your output must start with { and end with }.

Here is the JSON content to translate:
${jsonEncode(chunk)}
""";
  }

  // --- 辅助函数 ---

  /// 从 l10n.yaml 加载配置，并将其深度转换为标准的 Dart Map。
  Map<String, dynamic> _loadConfig() {
    final configFile = File('l10n.yaml');
    if (!configFile.existsSync()) {
      stderr.writeln("错误：未在项目根目录找到 l10n.yaml 文件。");
      exit(2);
    }
    final yamlContent = loadYaml(configFile.readAsStringSync());
    // 关键修正：使用递归函数将 YamlMap/YamlList 深度转换为标准 Map/List
    return _convertYamlToMap(yamlContent) as Map<String, dynamic>;
  }
  
  /// **新增：** 递归转换函数，将 Yaml 类型安全地转换为 Dart 内置类型。
  dynamic _convertYamlToMap(dynamic yaml) {
    if (yaml is YamlMap) {
      final map = <String, dynamic>{};
      for (final entry in yaml.entries) {
        map[entry.key.toString()] = _convertYamlToMap(entry.value);
      }
      return map;
    } else if (yaml is YamlList) {
      final list = <dynamic>[];
      for (final value in yaml) {
        list.add(_convertYamlToMap(value));
      }
      return list;
    }
    return yaml;
  }

  /// 加载并解析源语言 ARB 文件。
  Map<String, dynamic> _loadSourceMessages(
      String arbDir, String templateArbFile) {
    final sourceArbPath = p.join(arbDir, templateArbFile);
    final sourceFile = File(sourceArbPath);
    if (!sourceFile.existsSync()) {
      stderr.writeln("错误：源文件未找到于 $sourceArbPath");
      exit(2);
    }
    return jsonDecode(sourceFile.readAsStringSync()) as Map<String, dynamic>;
  }

  /// 将一个大的 Map 分割成多个指定大小的小 Map 列表。
  List<Map<String, dynamic>> _createChunks(
      Map<String, dynamic> messages, int size) {
    final chunks = <Map<String, dynamic>>[];
    var currentChunk = <String, dynamic>{};
    for (final entry in messages.entries) {
      currentChunk[entry.key] = entry.value;
      if (currentChunk.length >= size) {
        chunks.add(currentChunk);
        currentChunk = {};
      }
    }
    if (currentChunk.isNotEmpty) {
      chunks.add(currentChunk);
    }
    return chunks;
  }

  /// 根据源文件的 key 顺序对新内容进行排序，以保持一致性。
  Map<String, dynamic> _sortContent(
      Map<String, dynamic> newContent, Map<String, dynamic> sourceMessages) {
    final sortedContent = <String, dynamic>{};
    sourceMessages.forEach((key, value) {
      if (newContent.containsKey(key)) {
        sortedContent[key] = newContent[key];
      } else if (key.startsWith('@') && sourceMessages.containsKey(key)) {
        sortedContent[key] = sourceMessages[key];
      }
    });
    return sortedContent;
  }
}

/// 程序主入口。
void main(List<String> args) {
  CommandRunner("translate", "一个使用 l10n.yaml 配置来翻译 ARB 文件的工具。")
    ..addCommand(TranslateCommand())
    ..run(args).catchError((error) {
      stderr.writeln(error);
      exit(2);
    });
}
