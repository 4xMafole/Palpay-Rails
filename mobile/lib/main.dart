import 'package:flutter/material.dart';

import 'core/settings_store.dart';
import 'screens/connect_screen.dart';
import 'screens/home_screen.dart';
import 'theme/app_theme.dart';

void main() {
  runApp(const PalpayRailApp());
}

class PalpayRailApp extends StatelessWidget {
  const PalpayRailApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Palpay Rail',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark,
      home: const _StartupGate(),
    );
  }
}

/// Decides whether the manager has already connected this device to a server,
/// with a small branded splash while that (fast, local) check runs.
class _StartupGate extends StatefulWidget {
  const _StartupGate();

  @override
  State<_StartupGate> createState() => _StartupGateState();
}

class _StartupGateState extends State<_StartupGate> {
  final _settings = SettingsStore();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<bool>(
      future: _settings.isConfigured(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Scaffold(
            body: Center(
              child: Icon(
                Icons.shield_moon_rounded,
                color: AppColors.accent,
                size: 48,
              ),
            ),
          );
        }
        return snapshot.data! ? const HomeScreen() : const ConnectScreen();
      },
    );
  }
}
