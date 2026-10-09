/// Results from the shadow-mode preview and the one-tap attack simulator.
/// Both report policy outcomes; shadow mode never touches money, the simulator does.
library;

class ShadowProbeResult {
  ShadowProbeResult({
    required this.label,
    required this.rationale,
    required this.decision,
    required this.matchedRules,
    required this.failedRules,
  });

  factory ShadowProbeResult.fromJson(Map<String, dynamic> json) {
    return ShadowProbeResult(
      label: json['label'] as String,
      rationale: json['rationale'] as String,
      decision: json['decision'] as String,
      matchedRules: List<String>.from(
        json['matchedRules'] as List? ?? const [],
      ),
      failedRules: List<String>.from(json['failedRules'] as List? ?? const []),
    );
  }

  final String label;
  final String rationale;
  final String decision;
  final List<String> matchedRules;
  final List<String> failedRules;
}

class ShadowReport {
  ShadowReport({
    required this.results,
    required this.allowed,
    required this.needsApproval,
    required this.blocked,
    required this.wouldSpend,
    required this.currency,
  });

  factory ShadowReport.fromJson(Map<String, dynamic> json) {
    final summary = json['summary'] as Map<String, dynamic>;
    return ShadowReport(
      results: (json['results'] as List)
          .map((e) => ShadowProbeResult.fromJson(e as Map<String, dynamic>))
          .toList(),
      allowed: (summary['allowed'] as num).toInt(),
      needsApproval: (summary['needsApproval'] as num).toInt(),
      blocked: (summary['blocked'] as num).toInt(),
      wouldSpend: (summary['wouldSpend'] as num).toDouble(),
      currency: summary['currency'] as String,
    );
  }

  final List<ShadowProbeResult> results;
  final int allowed;
  final int needsApproval;
  final int blocked;
  final double wouldSpend;
  final String currency;
}

class SimulationStep {
  SimulationStep({
    required this.label,
    required this.expectation,
    required this.requestId,
    required this.decision,
    required this.matchedRules,
    required this.failedRules,
    required this.amount,
    required this.currency,
    required this.vendor,
    required this.paypalOrderId,
    required this.paypalStatus,
  });

  factory SimulationStep.fromJson(Map<String, dynamic> json) {
    return SimulationStep(
      label: json['label'] as String,
      expectation: json['expectation'] as String,
      requestId: json['requestId'] as String,
      decision: json['decision'] as String,
      matchedRules: List<String>.from(
        json['matchedRules'] as List? ?? const [],
      ),
      failedRules: List<String>.from(json['failedRules'] as List? ?? const []),
      amount: (json['amount'] as num).toDouble(),
      currency: json['currency'] as String,
      vendor: json['vendor'] as String,
      paypalOrderId: json['paypalOrderId'] as String?,
      paypalStatus: json['paypalStatus'] as String?,
    );
  }

  final String label;
  final String expectation;
  final String requestId;
  final String decision;
  final List<String> matchedRules;
  final List<String> failedRules;
  final double amount;
  final String currency;
  final String vendor;
  final String? paypalOrderId;
  final String? paypalStatus;
}

class SimulationReport {
  SimulationReport({
    required this.missionTitle,
    required this.totalBudget,
    required this.currency,
    required this.steps,
  });

  factory SimulationReport.fromJson(Map<String, dynamic> json) {
    return SimulationReport(
      missionTitle: json['missionTitle'] as String,
      totalBudget: (json['totalBudget'] as num).toDouble(),
      currency: json['currency'] as String,
      steps: (json['steps'] as List)
          .map((e) => SimulationStep.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  final String missionTitle;
  final double totalBudget;
  final String currency;
  final List<SimulationStep> steps;
}
