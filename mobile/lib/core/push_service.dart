import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'api_client.dart';

/// Best-effort FCM registration. If Firebase hasn't been configured for this
/// build (no google-services.json), this silently no-ops instead of crashing
/// the app — push is a nice-to-have on top of the in-app audit feed/polling.
class PushService {
  PushService(this._api);

  final ApiClient _api;

  Future<void> initAndRegister() async {
    try {
      await Firebase.initializeApp();
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      final token = await messaging.getToken();
      if (token != null) {
        await _api.registerDeviceToken(token);
      }
      FirebaseMessaging.instance.onTokenRefresh.listen(
        _api.registerDeviceToken,
      );
    } catch (_) {
      // Push is optional for the demo; the audit feed still polls regardless.
    }
  }
}
