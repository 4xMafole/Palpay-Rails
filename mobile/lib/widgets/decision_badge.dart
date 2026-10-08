import 'package:flutter/material.dart';

import '../core/models.dart';
import '../theme/app_theme.dart';

class DecisionBadge extends StatelessWidget {
  const DecisionBadge({super.key, required this.decision, this.approvalStatus});

  final Decision decision;
  final String? approvalStatus;

  (Color, String, IconData) _spec() {
    switch (decision) {
      case Decision.allowed:
        return (AppColors.allowed, 'Allowed', Icons.check_rounded);
      case Decision.needsApproval:
        if (approvalStatus == 'approved') {
          return (AppColors.allowed, 'Approved', Icons.check_rounded);
        }
        if (approvalStatus == 'rejected') {
          return (AppColors.blocked, 'Rejected', Icons.close_rounded);
        }
        return (
          AppColors.needsApproval,
          'Needs approval',
          Icons.hourglass_top_rounded,
        );
      case Decision.blocked:
        return (AppColors.blocked, 'Blocked', Icons.block_rounded);
    }
  }

  @override
  Widget build(BuildContext context) {
    final (color, label, icon) = _spec();
    final isPending =
        decision == Decision.needsApproval && approvalStatus == null;

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.85, end: 1),
      duration: const Duration(milliseconds: 350),
      curve: Curves.elasticOut,
      builder: (context, scale, child) =>
          Transform.scale(scale: scale, child: child),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: color.withValues(alpha: 0.4)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isPending)
              _PulsingDot(color: color)
            else
              Icon(icon, size: 14, color: color),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PulsingDot extends StatefulWidget {
  const _PulsingDot({required this.color});
  final Color color;

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween(begin: 0.3, end: 1.0).animate(_controller),
      child: Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle),
      ),
    );
  }
}
