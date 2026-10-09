/// Maps the policy engine's rule identifiers to language a manager can read.
/// Keep in sync with server/src/policy/engine.ts.
library;

const _ruleLabels = <String, String>{
  'valid_request_fields': 'Request details were complete',
  'mission_active': 'Mission is active',
  'mission_not_expired': 'Mission has not expired',
  'vendor_allowed': 'Vendor is on the approved list',
  'recurring_allowed': 'Payment type (one-time vs subscription) is permitted',
  'currency_match': 'Currency matches the mission',
  'within_max_amount': 'Within the per-payment limit',
  'within_mission_budget': 'Within the total mission budget',
  'below_near_limit_threshold': 'Not close enough to the limit to need review',
};

const _failedRuleLabels = <String, String>{
  'valid_request_fields': 'Request details were incomplete or ambiguous',
  'mission_active': 'Mission is no longer active',
  'mission_not_expired': 'Mission has expired',
  'vendor_allowed': 'Vendor is not on the approved list',
  'recurring_allowed': 'This mission does not allow subscriptions',
  'currency_match': 'Currency does not match the mission',
  'within_max_amount': 'Exceeds the per-payment limit',
  'within_mission_budget': 'Would exceed the total mission budget',
  'below_near_limit_threshold': 'Close to the limit, so it needs your review',
};

String ruleLabel(String rule, {required bool passed}) {
  final map = passed ? _ruleLabels : _failedRuleLabels;
  return map[rule] ?? rule.replaceAll('_', ' ');
}
