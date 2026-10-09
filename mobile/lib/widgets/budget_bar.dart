import 'package:flutter/material.dart';

import '../core/models.dart';
import '../theme/app_theme.dart';

/// Shows how much of a mission's cumulative budget has been consumed.
/// This is the control that stops an agent overspending in small, individually
/// legal chunks, so it gets first-class billing in the UI.
class BudgetBar extends StatelessWidget {
  const BudgetBar({super.key, required this.mission});

  final Mission mission;

  @override
  Widget build(BuildContext context) {
    final used = mission.budgetUsedFraction;
    final exhausted = mission.budgetRemaining <= 0;
    final color = exhausted
        ? AppColors.blocked
        : used > 0.9
        ? AppColors.needsApproval
        : AppColors.allowed;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                mission.title,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Text(
              exhausted
                  ? 'Budget spent'
                  : '${mission.currency} ${mission.budgetRemaining.toStringAsFixed(2)} left',
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: used),
            duration: const Duration(milliseconds: 650),
            curve: Curves.easeOutCubic,
            builder: (context, value, _) => LinearProgressIndicator(
              value: value,
              minHeight: 6,
              backgroundColor: AppColors.surfaceRaised,
              valueColor: AlwaysStoppedAnimation(color),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          '${mission.currency} ${mission.spentToDate.toStringAsFixed(2)} of '
          '${mission.currency} ${mission.totalBudget.toStringAsFixed(2)} spent',
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
        ),
      ],
    );
  }
}
