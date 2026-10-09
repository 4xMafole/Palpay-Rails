import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';
import 'settings_store.dart';

class ApiException implements Exception {
  ApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

/// Thin REST client for the Palpay Rail server's manager-authenticated endpoints.
class ApiClient {
  ApiClient(this._settings);

  final SettingsStore _settings;

  // Without this, an unreachable/wrong server URL just spins forever instead
  // of failing with a message the user can act on.
  static const _defaultTimeout = Duration(seconds: 20);
  // The draft endpoint calls Gemini and may hit a cold Render instance —
  // both can push well past a normal request's latency.
  static const _llmTimeout = Duration(seconds: 75);

  Future<http.Response> _withTimeout(
    Future<http.Response> request, {
    Duration timeout = _defaultTimeout,
  }) {
    return request.timeout(
      timeout,
      onTimeout: () => throw ApiException(
        'Could not reach the server at the configured URL. '
        'Check it in Settings (tap the logout icon to reconnect).',
      ),
    );
  }

  Future<Map<String, String>> _headers() async {
    final key = await _settings.getManagerKey();
    return {
      'Content-Type': 'application/json',
      if (key != null) 'Authorization': 'Bearer $key',
    };
  }

  Future<Uri> _uri(String path) async {
    final base = (await _settings.getBaseUrl())?.trim() ?? '';
    final normalized = base.endsWith('/')
        ? base.substring(0, base.length - 1)
        : base;
    return Uri.parse('$normalized$path');
  }

  Map<String, dynamic> _decodeOrThrow(http.Response response) {
    final Map<String, dynamic> body = response.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      // The server re-checks policy immediately before paying; a 409 means the
      // mission changed (cancelled, expired, or budget used up) since this
      // request was raised, so the approval was refused rather than paid.
      if (response.statusCode == 409 &&
          body['error'] == 'revalidation_failed') {
        final failed = List<String>.from(
          body['failedRules'] as List? ?? const [],
        );
        throw ApiException(
          'Approval refused — the mission no longer permits this payment'
          '${failed.isEmpty ? '' : ' (${failed.join(', ')})'}.',
        );
      }
      throw ApiException(
        (body['message'] ??
                body['error'] ??
                'Request failed (${response.statusCode})')
            .toString(),
      );
    }
    return body;
  }

  Future<({MissionDraft draft, String rawInstruction})> draftMission(
    String instruction,
  ) async {
    final response = await _withTimeout(
      http.post(
        await _uri('/missions/draft'),
        headers: await _headers(),
        body: jsonEncode({'instruction': instruction}),
      ),
      timeout: _llmTimeout,
    );
    final body = _decodeOrThrow(response);
    return (
      draft: MissionDraft.fromJson(body['draft'] as Map<String, dynamic>),
      rawInstruction: body['rawInstruction'] as String,
    );
  }

  Future<Mission> confirmMission({
    required MissionDraft draft,
    required String rawInstruction,
  }) async {
    final response = await _withTimeout(
      http.post(
        await _uri('/missions'),
        headers: await _headers(),
        body: jsonEncode({
          'draft': draft.toJson(),
          'rawInstruction': rawInstruction,
        }),
      ),
    );
    return Mission.fromJson(_decodeOrThrow(response));
  }

  Future<List<Mission>> listMissions() async {
    final response = await _withTimeout(
      http.get(await _uri('/missions'), headers: await _headers()),
    );
    if (response.statusCode != 200) {
      throw ApiException('Failed to load missions (${response.statusCode})');
    }
    final list = jsonDecode(response.body) as List;
    return list
        .map((e) => Mission.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<PurchaseRequest>> listRequests() async {
    final response = await _withTimeout(
      http.get(await _uri('/requests'), headers: await _headers()),
    );
    if (response.statusCode != 200) {
      throw ApiException(
        'Failed to load the audit feed (${response.statusCode})',
      );
    }
    final list = jsonDecode(response.body) as List;
    return list
        .map((e) => PurchaseRequest.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<PurchaseRequest> approveRequest(String id) async {
    final response = await _withTimeout(
      http.post(await _uri('/requests/$id/approve'), headers: await _headers()),
    );
    return PurchaseRequest.fromJson(_decodeOrThrow(response));
  }

  Future<PurchaseRequest> rejectRequest(String id) async {
    final response = await _withTimeout(
      http.post(await _uri('/requests/$id/reject'), headers: await _headers()),
    );
    return PurchaseRequest.fromJson(_decodeOrThrow(response));
  }

  Future<void> registerDeviceToken(String fcmToken) async {
    await _withTimeout(
      http.post(
        await _uri('/device-tokens'),
        headers: await _headers(),
        body: jsonEncode({'fcmToken': fcmToken}),
      ),
    );
  }
}
