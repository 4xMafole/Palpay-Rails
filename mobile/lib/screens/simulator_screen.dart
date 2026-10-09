import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/demo_models.dart';
import '../core/rule_labels.dart';
import '../core/settings_store.dart';
import '../theme/app_theme.dart';
import '../widgets/fade_slide_in.dart';
import '../widgets/press_scale.dart';

/// One-tap demo: fires a scripted rogue-agent attack at the live policy engine so
/// all three outcomes can be seen without configuring an agent first.
class SimulatorScreen extends StatefulWidget {
  const SimulatorScreen({super.key});

  @override
  State<SimulatorScreen> createState() => _SimulatorScreenState();
}

class _SimulatorScreenState extends State<SimulatorScreen> {
  final _settings = SettingsStore();
  late final _api = ApiClient(_settings);

  bool _running = false;
  SimulationReport? _report;
  String? _error;

  Future<void> _run() async {
    setState(() {
      _running = true;
      _error = null;
      _report = null;
    });
    try {
      final report = await _api.runSimulation();
      if (!mounted) return;
      setState(() {
        _report = report;
        _running = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _running = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final report = _report;

    return Scaffold(
      appBar: AppBar(title: const Text('Rogue agent simulator')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          const Text(
            'Runs five purchase attempts against a fresh mission — one legitimate, '
            'four that each break a different rule. Everything below is decided by '
            'the real policy engine, and the allowed step makes a real PayPal '
            'sandbox payment.',
            style: TextStyle(color: AppColors.textSecondary, height: 1.5),
          ),
          const SizedBox(height: 20),
          PressScale(
            onTap: _running ? () {} : _run,
            child: ElevatedButton.icon(
              onPressed: _running ? null : _run,
              icon: _running
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.2,
                        color: Colors.black,
                      ),
                    )
                  : const Icon(Icons.play_arrow_rounded),
              label: Text(_running ? 'Running attack…' : 'Simulate attack'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(_error!, style: const TextStyle(color: AppColors.blocked)),
          ],
          if (report != null) ...[
            const SizedBox(height: 22),
            _summary(report),
            const SizedBox(height: 16),
            for (var i = 0; i < report.steps.length; i++) ...[
              FadeSlideIn(index: i, child: _stepCard(i + 1, report.steps[i])),
              const SizedBox(height: 10),
            ],
          ],
        ],
      ),
    );
  }

  Widget _summary(SimulationReport report) {
    final paid = report.steps
        .where((s) => s.paypalStatus == 'COMPLETED')
        .fold<double>(0, (sum, s) => sum + s.amount);
    final stopped = report.steps.where((s) => s.decision != 'ALLOWED').length;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.accent.withValues(alpha: 0.16), AppColors.surface],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.accent.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$stopped of ${report.steps.length} attempts stopped',
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
          ),
          const SizedBox(height: 6),
          Text(
            'Only ${report.currency} ${paid.toStringAsFixed(2)} was allowed to move, '
            'against a ${report.currency} ${report.totalBudget.toStringAsFixed(2)} mission budget.',
            style: const TextStyle(color: AppColors.textSecondary, height: 1.4),
          ),
        ],
      ),
    );
  }

  Widget _stepCard(int index, SimulationStep step) {
    final (color, icon, label) = switch (step.decision) {
      'ALLOWED' => (AppColors.allowed, Icons.check_circle_rounded, 'Allowed'),
      'NEEDS_APPROVAL' => (
        AppColors.needsApproval,
        Icons.pan_tool_rounded,
        'Needs approval',
      ),
      _ => (AppColors.blocked, Icons.block_rounded, 'Blocked'),
    };

    final reason = step.failedRules.isNotEmpty
        ? ruleLabel(step.failedRules.first, passed: false)
        : step.expectation;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '$index. ${step.label}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            reason,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 13,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Text(
                '${step.currency} ${step.amount.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  step.vendor.isEmpty ? '(no vendor given)' : step.vendor,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          if (step.paypalOrderId != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(
                  Icons.receipt_long_rounded,
                  size: 13,
                  color: AppColors.textSecondary,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'PayPal ${step.paypalOrderId} · ${step.paypalStatus}',
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 11,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
