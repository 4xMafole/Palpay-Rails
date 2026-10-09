import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/models.dart';
import '../core/rule_labels.dart';
import '../core/settings_store.dart';
import '../theme/app_theme.dart';
import '../widgets/decision_badge.dart';
import '../widgets/fade_slide_in.dart';
import '../widgets/press_scale.dart';

class RequestDetailScreen extends StatefulWidget {
  const RequestDetailScreen({
    super.key,
    required this.request,
    this.missionTitle,
  });

  final PurchaseRequest request;
  final String? missionTitle;

  @override
  State<RequestDetailScreen> createState() => _RequestDetailScreenState();
}

class _RequestDetailScreenState extends State<RequestDetailScreen> {
  final _settings = SettingsStore();
  late final _api = ApiClient(_settings);
  late PurchaseRequest _request = widget.request;
  bool _busy = false;
  String? _error;

  bool get _isPending =>
      _request.decision == Decision.needsApproval &&
      _request.approvalStatus == null;

  Future<void> _act(Future<PurchaseRequest> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final updated = await action();
      setState(() => _request = updated);
      await Future.delayed(const Duration(milliseconds: 450));
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() {
        _busy = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final request = _request;
    return Scaffold(
      appBar: AppBar(title: const Text('Request')),
      body: SafeArea(
        child: Stack(
          children: [
            ListView(
              padding: EdgeInsets.fromLTRB(20, 12, 20, _isPending ? 110 : 24),
              children: [
                Center(
                  child: AnimatedScale(
                    scale: _busy ? 0.9 : 1,
                    duration: const Duration(milliseconds: 250),
                    child: DecisionBadge(
                      decision: request.decision,
                      approvalStatus: request.approvalStatus,
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        request.vendor,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 18,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        request.itemDescription,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          height: 1.4,
                        ),
                      ),
                      const Divider(height: 28),
                      _row(
                        'Amount',
                        '${request.currency} ${request.amount.toStringAsFixed(2)}',
                      ),
                      _row(
                        'Recurring',
                        request.isRecurring ? 'Yes' : 'No, one-time',
                      ),
                      if (widget.missionTitle != null)
                        _row('Mission', widget.missionTitle!),
                      _row(
                        'Submitted',
                        request.createdAt.toLocal().toString().split('.').first,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                if (request.explanation != null &&
                    request.explanation!.trim().isNotEmpty) ...[
                  _explanationCard(request.explanation!),
                  const SizedBox(height: 16),
                ],
                _rulesCard(request),
                if (request.paypalOrderId != null) ...[
                  const SizedBox(height: 16),
                  _paypalCard(request),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    _error!,
                    style: const TextStyle(color: AppColors.blocked),
                  ),
                ],
              ],
            ),
            if (_isPending)
              Align(
                alignment: Alignment.bottomCenter,
                child: Container(
                  padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
                  decoration: const BoxDecoration(
                    color: AppColors.background,
                    border: Border(top: BorderSide(color: AppColors.divider)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: PressScale(
                          onTap: _busy
                              ? () {}
                              : () =>
                                    _act(() => _api.rejectRequest(request.id)),
                          child: OutlinedButton(
                            onPressed: _busy
                                ? null
                                : () => _act(
                                    () => _api.rejectRequest(request.id),
                                  ),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.blocked,
                              side: const BorderSide(color: AppColors.blocked),
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            child: const Text('Reject'),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: PressScale(
                          onTap: _busy
                              ? () {}
                              : () =>
                                    _act(() => _api.approveRequest(request.id)),
                          child: ElevatedButton(
                            onPressed: _busy
                                ? null
                                : () => _act(
                                    () => _api.approveRequest(request.id),
                                  ),
                            child: _busy
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.2,
                                      color: Colors.black,
                                    ),
                                  )
                                : const Text('Approve & pay'),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _explanationCard(String explanation) {
    return FadeSlideIn(
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.accent.withValues(alpha: 0.14),
              AppColors.surface,
            ],
          ),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.accent.withValues(alpha: 0.25)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(
              Icons.auto_awesome_rounded,
              color: AppColors.accent,
              size: 20,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                explanation,
                style: const TextStyle(height: 1.4, fontSize: 14),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.textSecondary)),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _rulesCard(PurchaseRequest request) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Why this decision',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 10),
          for (final rule in request.matchedRules) _ruleLine(rule, true),
          for (final rule in request.failedRules) _ruleLine(rule, false),
        ],
      ),
    );
  }

  Widget _ruleLine(String rule, bool passed) {
    final color = passed ? AppColors.allowed : AppColors.blocked;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            passed ? Icons.check_circle_rounded : Icons.cancel_rounded,
            color: color,
            size: 16,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              ruleLabel(rule, passed: passed),
              style: const TextStyle(fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }

  Widget _paypalCard(PurchaseRequest request) {
    final completed = request.paypalStatus == 'COMPLETED';
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Icon(
            completed ? Icons.verified_rounded : Icons.error_outline_rounded,
            color: completed ? AppColors.allowed : AppColors.needsApproval,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'PayPal sandbox: ${request.paypalStatus}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                Text(
                  'Order ${request.paypalOrderId}',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
