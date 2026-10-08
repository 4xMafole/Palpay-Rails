import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/models.dart';
import '../core/settings_store.dart';
import '../theme/app_theme.dart';
import '../widgets/press_scale.dart';

enum _Step { instruction, review, saving, done }

class CreateMissionScreen extends StatefulWidget {
  const CreateMissionScreen({super.key});

  @override
  State<CreateMissionScreen> createState() => _CreateMissionScreenState();
}

class _CreateMissionScreenState extends State<CreateMissionScreen> {
  final _settings = SettingsStore();
  late final _api = ApiClient(_settings);

  final _instructionController = TextEditingController();
  _Step _step = _Step.instruction;
  String? _error;

  String _rawInstruction = '';
  final _titleController = TextEditingController();
  final _purposeController = TextEditingController();
  final _maxAmountController = TextEditingController();
  final _currencyController = TextEditingController();
  final _vendorInputController = TextEditingController();
  List<String> _vendors = [];
  bool _allowRecurring = false;
  bool _nearLimitApproval = false;
  DateTime _expiresAt = DateTime.now().add(const Duration(days: 30));

  @override
  void dispose() {
    _instructionController.dispose();
    _titleController.dispose();
    _purposeController.dispose();
    _maxAmountController.dispose();
    _currencyController.dispose();
    _vendorInputController.dispose();
    super.dispose();
  }

  Future<void> _draftWithAi() async {
    if (_instructionController.text.trim().length < 10) {
      setState(() => _error = 'Describe the mission in a bit more detail.');
      return;
    }
    setState(() {
      _step = _Step.saving;
      _error = null;
    });
    try {
      final result = await _api.draftMission(
        _instructionController.text.trim(),
      );
      final draft = result.draft;
      setState(() {
        _rawInstruction = result.rawInstruction;
        _titleController.text = draft.title;
        _purposeController.text = draft.purpose;
        _maxAmountController.text = draft.maxAmount.toStringAsFixed(2);
        _currencyController.text = draft.currency;
        _vendors = List.of(draft.vendorAllowlist);
        _allowRecurring = draft.allowRecurring;
        _nearLimitApproval = draft.approvalTriggers.contains('near_limit');
        _expiresAt = DateTime.tryParse(draft.expiresAt) ?? _expiresAt;
        _step = _Step.review;
      });
    } catch (e) {
      setState(() {
        _step = _Step.instruction;
        _error = e.toString();
      });
    }
  }

  Future<void> _confirm() async {
    if (_vendors.isEmpty) {
      setState(() => _error = 'Add at least one approved vendor.');
      return;
    }
    final maxAmount = double.tryParse(_maxAmountController.text.trim());
    if (maxAmount == null || maxAmount <= 0) {
      setState(() => _error = 'Enter a valid maximum amount.');
      return;
    }

    final draft = MissionDraft(
      title: _titleController.text.trim(),
      purpose: _purposeController.text.trim(),
      vendorAllowlist: _vendors,
      maxAmount: maxAmount,
      currency: _currencyController.text.trim().toUpperCase(),
      allowRecurring: _allowRecurring,
      approvalTriggers: _nearLimitApproval ? ['near_limit'] : [],
      expiresAt: _expiresAt.toUtc().toIso8601String(),
    );

    setState(() {
      _step = _Step.saving;
      _error = null;
    });
    try {
      await _api.confirmMission(draft: draft, rawInstruction: _rawInstruction);
      if (!mounted) return;
      setState(() => _step = _Step.done);
      await Future.delayed(const Duration(milliseconds: 650));
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      setState(() {
        _step = _Step.review;
        _error = e.toString();
      });
    }
  }

  void _addVendor() {
    final value = _vendorInputController.text.trim();
    if (value.isEmpty) return;
    setState(() {
      _vendors.add(value);
      _vendorInputController.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('New mission')),
      body: SafeArea(
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 380),
          switchInCurve: Curves.easeOutCubic,
          switchOutCurve: Curves.easeInCubic,
          transitionBuilder: (child, animation) => FadeTransition(
            opacity: animation,
            child: SlideTransition(
              position: Tween(
                begin: const Offset(0, 0.04),
                end: Offset.zero,
              ).animate(animation),
              child: child,
            ),
          ),
          child: switch (_step) {
            _Step.instruction => _buildInstructionStep(),
            _Step.review => _buildReviewStep(),
            _Step.saving => const _CenteredSpinner(key: ValueKey('saving')),
            _Step.done => const _SuccessStamp(key: ValueKey('done')),
          },
        ),
      ),
    );
  }

  Widget _buildInstructionStep() {
    return Padding(
      key: const ValueKey('instruction'),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Describe the mission',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          const Text(
            'Plain language. Who can get paid, for what, how much, and whether it can repeat.',
            style: TextStyle(color: AppColors.textSecondary, height: 1.4),
          ),
          const SizedBox(height: 20),
          Expanded(
            child: TextField(
              controller: _instructionController,
              maxLines: null,
              expands: true,
              textAlignVertical: TextAlignVertical.top,
              style: const TextStyle(color: AppColors.textPrimary),
              decoration: const InputDecoration(
                hintText: 'Find a one-time transcription service for this project. Use Acme Transcribe, spend no more than \$25, no subscriptions.',
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(
              _error!,
              style: const TextStyle(color: AppColors.blocked, fontSize: 13),
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: PressScale(
              onTap: _draftWithAi,
              child: ElevatedButton.icon(
                onPressed: _draftWithAi,
                icon: const Icon(Icons.auto_awesome_rounded, size: 18),
                label: const Text('Draft with AI'),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReviewStep() {
    return SingleChildScrollView(
      key: const ValueKey('review'),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Review the policy',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 4),
          const Text(
            'Gemini drafted this from your instruction. Nothing activates until you confirm.',
            style: TextStyle(color: AppColors.textSecondary, height: 1.4),
          ),
          const SizedBox(height: 20),
          _field('Title', _titleController),
          const SizedBox(height: 14),
          _field('Purpose', _purposeController, maxLines: 2),
          const SizedBox(height: 18),
          const Text(
            'Approved vendors',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final vendor in _vendors)
                Chip(
                  label: Text(vendor),
                  backgroundColor: AppColors.surfaceRaised,
                  labelStyle: const TextStyle(color: AppColors.textPrimary),
                  deleteIconColor: AppColors.textSecondary,
                  onDeleted: () => setState(() => _vendors.remove(vendor)),
                  shape: const StadiumBorder(side: BorderSide.none),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _vendorInputController,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: const InputDecoration(
                    hintText: 'Add another vendor',
                  ),
                  onSubmitted: (_) => _addVendor(),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                onPressed: _addVendor,
                icon: const Icon(Icons.add_rounded),
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.accent,
                  foregroundColor: Colors.black,
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: _field(
                  'Max amount',
                  _maxAmountController,
                  keyboardType: TextInputType.number,
                ),
              ),
              const SizedBox(width: 12),
              SizedBox(
                width: 90,
                child: _field('Currency', _currencyController),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _switchRow(
            'Allow recurring charges',
            'Off blocks any subscription attempt outright.',
            _allowRecurring,
            (v) => setState(() => _allowRecurring = v),
          ),
          _switchRow(
            'Ask me near the limit',
            'Escalate to approval above 90% of the max amount.',
            _nearLimitApproval,
            (v) => setState(() => _nearLimitApproval = v),
          ),
          const SizedBox(height: 8),
          PressScale(
            onTap: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: _expiresAt,
                firstDate: DateTime.now(),
                lastDate: DateTime.now().add(const Duration(days: 365)),
              );
              if (picked != null) setState(() => _expiresAt = picked);
            },
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surfaceRaised,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.event_rounded,
                    color: AppColors.textSecondary,
                    size: 18,
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'Expires ${_expiresAt.toLocal().toString().split(' ').first}',
                  ),
                ],
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 14),
            Text(
              _error!,
              style: const TextStyle(color: AppColors.blocked, fontSize: 13),
            ),
          ],
          const SizedBox(height: 22),
          SizedBox(
            width: double.infinity,
            child: PressScale(
              onTap: _confirm,
              child: ElevatedButton.icon(
                onPressed: _confirm,
                icon: const Icon(Icons.verified_rounded, size: 18),
                label: const Text('Confirm & activate'),
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  Widget _field(
    String label,
    TextEditingController controller, {
    int maxLines = 1,
    TextInputType? keyboardType,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          maxLines: maxLines,
          keyboardType: keyboardType,
          style: const TextStyle(color: AppColors.textPrimary),
        ),
      ],
    );
  }

  Widget _switchRow(
    String title,
    String subtitle,
    bool value,
    ValueChanged<bool> onChanged,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: AppColors.accent,
          ),
        ],
      ),
    );
  }
}

class _CenteredSpinner extends StatelessWidget {
  const _CenteredSpinner({super.key});
  @override
  Widget build(BuildContext context) {
    return const Center(
      child: CircularProgressIndicator(color: AppColors.accent),
    );
  }
}

class _SuccessStamp extends StatefulWidget {
  const _SuccessStamp({super.key});
  @override
  State<_SuccessStamp> createState() => _SuccessStampState();
}

class _SuccessStampState extends State<_SuccessStamp>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 500),
  )..forward();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ScaleTransition(
            scale: CurvedAnimation(
              parent: _controller,
              curve: Curves.elasticOut,
            ),
            child: Container(
              width: 84,
              height: 84,
              decoration: const BoxDecoration(
                color: AppColors.allowed,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_rounded,
                color: Colors.black,
                size: 44,
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Mission active',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
          ),
        ],
      ),
    );
  }
}
