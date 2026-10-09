import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/api_client.dart';
import '../core/models.dart';
import '../core/push_service.dart';
import '../core/settings_store.dart';
import '../theme/app_theme.dart';
import '../widgets/budget_bar.dart';
import '../widgets/decision_badge.dart';
import '../widgets/fade_slide_in.dart';
import '../widgets/press_scale.dart';
import 'connect_screen.dart';
import 'create_mission_screen.dart';
import 'request_detail_screen.dart';
import 'simulator_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _settings = SettingsStore();
  late final _api = ApiClient(_settings);
  Timer? _poller;

  List<PurchaseRequest> _requests = [];
  Map<String, Mission> _missionsById = {};
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
    PushService(_api).initAndRegister();
    _poller = Timer.periodic(
      const Duration(seconds: 8),
      (_) => _load(silent: true),
    );
  }

  @override
  void dispose() {
    _poller?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _api.listRequests(),
        _api.listMissions(),
      ]);
      final requests = results[0] as List<PurchaseRequest>;
      final missions = results[1] as List<Mission>;
      if (!mounted) return;
      setState(() {
        _requests = requests;
        _missionsById = {for (final m in missions) m.id: m};
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = silent ? _error : e.toString();
      });
    }
  }

  Future<void> _openCreateMission() async {
    final created = await Navigator.of(context).push<bool>(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 420),
        pageBuilder: (_, _, _) => const CreateMissionScreen(),
        transitionsBuilder: (_, animation, _, child) {
          final curved = CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
          );
          return SlideTransition(
            position: Tween(
              begin: const Offset(0, 1),
              end: Offset.zero,
            ).animate(curved),
            child: child,
          );
        },
      ),
    );
    if (created == true) _load();
  }

  Future<void> _openRequest(PurchaseRequest request) async {
    final mission = _missionsById[request.missionId];
    final changed = await Navigator.of(context).push<bool>(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 380),
        pageBuilder: (_, _, _) =>
            RequestDetailScreen(request: request, missionTitle: mission?.title),
        transitionsBuilder: (_, animation, _, child) {
          final curved = CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
          );
          return SlideTransition(
            position: Tween(
              begin: const Offset(1, 0),
              end: Offset.zero,
            ).animate(curved),
            child: child,
          );
        },
      ),
    );
    if (changed == true) _load();
  }

  Future<void> _openSimulator() async {
    await Navigator.of(context).push(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 380),
        pageBuilder: (_, _, _) => const SimulatorScreen(),
        transitionsBuilder: (_, animation, _, child) {
          final curved = CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
          );
          return FadeTransition(
            opacity: curved,
            child: ScaleTransition(
              scale: Tween(begin: 0.96, end: 1.0).animate(curved),
              child: child,
            ),
          );
        },
      ),
    );
    // The simulation creates a mission and real requests, so refresh the feed.
    _load();
  }

  Future<void> _disconnect() async {
    await _settings.clear();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const ConnectScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Audit feed'),
        actions: [
          IconButton(
            tooltip: 'Rogue agent simulator',
            onPressed: _openSimulator,
            icon: const Icon(Icons.science_rounded, color: AppColors.accent),
          ),
          IconButton(
            onPressed: _disconnect,
            icon: const Icon(
              Icons.logout_rounded,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreateMission,
        icon: const Icon(Icons.add_rounded),
        label: const Text('New mission'),
      ),
      body: RefreshIndicator(
        color: AppColors.accent,
        backgroundColor: AppColors.surface,
        onRefresh: () => _load(),
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.accent),
      );
    }
    if (_error != null) {
      return ListView(
        children: [
          const SizedBox(height: 120),
          Icon(
            Icons.cloud_off_rounded,
            color: AppColors.textSecondary,
            size: 40,
          ),
          const SizedBox(height: 12),
          Center(
            child: Text(
              _error!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondary),
            ),
          ),
        ],
      );
    }
    if (_requests.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 140),
          Icon(Icons.shield_outlined, color: AppColors.textSecondary, size: 44),
          SizedBox(height: 16),
          Center(
            child: Text(
              'No activity yet.\nCreate a mission to give an agent\na purpose-bound permission slip.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary, height: 1.5),
            ),
          ),
        ],
      );
    }

    final dateFormat = DateFormat('MMM d, h:mm a');
    final activeMissions = _missionsById.values
        .where((m) => m.status == 'active')
        .toList();

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
      itemCount: _requests.length + (activeMissions.isEmpty ? 0 : 1),
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        if (activeMissions.isNotEmpty && index == 0) {
          return FadeSlideIn(
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Active mission budgets',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                  const SizedBox(height: 14),
                  for (final m in activeMissions) ...[
                    BudgetBar(mission: m),
                    if (m != activeMissions.last) const SizedBox(height: 18),
                  ],
                ],
              ),
            ),
          );
        }

        final request = _requests[activeMissions.isEmpty ? index : index - 1];
        final mission = _missionsById[request.missionId];
        return FadeSlideIn(
          index: index,
          child: PressScale(
            onTap: () => _openRequest(request),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          request.vendor,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      DecisionBadge(
                        decision: request.decision,
                        approvalStatus: request.approvalStatus,
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    request.itemDescription,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 13,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Text(
                        '${request.currency} ${request.amount.toStringAsFixed(2)}',
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                        ),
                      ),
                      if (request.isRecurring) ...[
                        const SizedBox(width: 6),
                        const Icon(
                          Icons.repeat_rounded,
                          size: 14,
                          color: AppColors.textSecondary,
                        ),
                      ],
                      const Spacer(),
                      if (mission != null)
                        Flexible(
                          child: Text(
                            mission.title,
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 12,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    dateFormat.format(request.createdAt.toLocal()),
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
