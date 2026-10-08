import 'package:shared_preferences/shared_preferences.dart';

/// Local-only connection settings. Never sent anywhere except as the
/// Authorization header on requests the user's own device makes to their own server.
class SettingsStore {
  static const _keyBaseUrl = 'palpay_server_base_url';
  static const _keyManagerKey = 'palpay_manager_api_key';

  Future<String?> getBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyBaseUrl);
  }

  Future<String?> getManagerKey() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyManagerKey);
  }

  Future<void> save({
    required String baseUrl,
    required String managerKey,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyBaseUrl, baseUrl);
    await prefs.setString(_keyManagerKey, managerKey);
  }

  Future<bool> isConfigured() async {
    final baseUrl = await getBaseUrl();
    final managerKey = await getManagerKey();
    return (baseUrl?.isNotEmpty ?? false) && (managerKey?.isNotEmpty ?? false);
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyBaseUrl);
    await prefs.remove(_keyManagerKey);
  }
}
