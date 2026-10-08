import 'package:flutter/material.dart';

import '../core/settings_store.dart';
import '../theme/app_theme.dart';
import '../widgets/press_scale.dart';
import 'home_screen.dart';

class ConnectScreen extends StatefulWidget {
  const ConnectScreen({super.key});

  @override
  State<ConnectScreen> createState() => _ConnectScreenState();
}

class _ConnectScreenState extends State<ConnectScreen>
    with SingleTickerProviderStateMixin {
  final _urlController = TextEditingController(
    text: 'https://palpay-rail-api.onrender.com',
  );
  final _keyController = TextEditingController();
  final _settings = SettingsStore();
  bool _saving = false;
  String? _error;

  late final AnimationController _entrance = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 600),
  )..forward();

  @override
  void dispose() {
    _entrance.dispose();
    _urlController.dispose();
    _keyController.dispose();
    super.dispose();
  }

  Future<void> _connect() async {
    if (_urlController.text.trim().isEmpty ||
        _keyController.text.trim().isEmpty) {
      setState(() => _error = 'Both fields are required.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    await _settings.save(
      baseUrl: _urlController.text.trim(),
      managerKey: _keyController.text.trim(),
    );
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 500),
        pageBuilder: (_, _, _) => const HomeScreen(),
        transitionsBuilder: (_, animation, _, child) =>
            FadeTransition(opacity: animation, child: child),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: FadeTransition(
            opacity: _entrance,
            child: SlideTransition(
              position:
                  Tween<Offset>(
                    begin: const Offset(0, 0.04),
                    end: Offset.zero,
                  ).animate(
                    CurvedAnimation(parent: _entrance, curve: Curves.easeOut),
                  ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: AppColors.accent.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(
                      Icons.shield_moon_rounded,
                      color: AppColors.accent,
                      size: 30,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Palpay Rail',
                    style: Theme.of(context).textTheme.headlineSmall
                        ?.copyWith(fontSize: 32),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'A permission slip for every AI agent payment.\nConnect to your server to get started.',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 36),
                  TextField(
                    controller: _urlController,
                    style: const TextStyle(color: AppColors.textPrimary),
                    decoration: const InputDecoration(
                      labelText: 'Server URL',
                      hintText: 'https://your-server.onrender.com',
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _keyController,
                    obscureText: true,
                    style: const TextStyle(color: AppColors.textPrimary),
                    decoration: const InputDecoration(
                      labelText: 'Manager API key',
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      _error!,
                      style: const TextStyle(
                        color: AppColors.blocked,
                        fontSize: 13,
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: PressScale(
                      onTap: _saving ? () {} : _connect,
                      child: ElevatedButton(
                        onPressed: _saving ? null : _connect,
                        child: _saving
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.4,
                                  color: Colors.black,
                                ),
                              )
                            : const Text('Connect'),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
