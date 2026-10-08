/// Mirrors the server's policy/types.ts shapes (camelCase JSON over the wire).
library;

enum Decision { allowed, needsApproval, blocked }

Decision decisionFromJson(String value) {
  switch (value) {
    case 'ALLOWED':
      return Decision.allowed;
    case 'NEEDS_APPROVAL':
      return Decision.needsApproval;
    default:
      return Decision.blocked;
  }
}

class MissionDraft {
  MissionDraft({
    required this.title,
    required this.purpose,
    required this.vendorAllowlist,
    required this.maxAmount,
    required this.currency,
    required this.allowRecurring,
    required this.approvalTriggers,
    required this.expiresAt,
  });

  factory MissionDraft.fromJson(Map<String, dynamic> json) {
    return MissionDraft(
      title: json['title'] as String,
      purpose: json['purpose'] as String,
      vendorAllowlist: List<String>.from(json['vendorAllowlist'] as List),
      maxAmount: (json['maxAmount'] as num).toDouble(),
      currency: json['currency'] as String,
      allowRecurring: json['allowRecurring'] as bool,
      approvalTriggers: List<String>.from(json['approvalTriggers'] as List),
      expiresAt: json['expiresAt'] as String,
    );
  }

  String title;
  String purpose;
  List<String> vendorAllowlist;
  double maxAmount;
  String currency;
  bool allowRecurring;
  List<String> approvalTriggers;
  String expiresAt;

  Map<String, dynamic> toJson() => {
    'title': title,
    'purpose': purpose,
    'vendorAllowlist': vendorAllowlist,
    'maxAmount': maxAmount,
    'currency': currency,
    'allowRecurring': allowRecurring,
    'approvalTriggers': approvalTriggers,
    'expiresAt': expiresAt,
  };
}

class Mission {
  Mission({
    required this.id,
    required this.title,
    required this.status,
    required this.maxAmount,
    required this.currency,
  });

  factory Mission.fromJson(Map<String, dynamic> json) {
    return Mission(
      id: json['id'] as String,
      title: json['title'] as String,
      status: json['status'] as String,
      maxAmount: (json['maxAmount'] as num).toDouble(),
      currency: json['currency'] as String,
    );
  }

  final String id;
  final String title;
  final String status;
  final double maxAmount;
  final String currency;
}

class PurchaseRequest {
  PurchaseRequest({
    required this.id,
    required this.missionId,
    required this.vendor,
    required this.itemDescription,
    required this.amount,
    required this.currency,
    required this.isRecurring,
    required this.decision,
    required this.matchedRules,
    required this.failedRules,
    required this.explanation,
    required this.approvalStatus,
    required this.paypalOrderId,
    required this.paypalStatus,
    required this.createdAt,
  });

  factory PurchaseRequest.fromJson(Map<String, dynamic> json) {
    return PurchaseRequest(
      id: json['id'] as String,
      missionId: json['missionId'] as String,
      vendor: json['vendor'] as String,
      itemDescription: json['itemDescription'] as String,
      amount: (json['amount'] as num).toDouble(),
      currency: json['currency'] as String,
      isRecurring: json['isRecurring'] as bool,
      decision: decisionFromJson(json['decision'] as String),
      matchedRules: List<String>.from(
        json['matchedRules'] as List? ?? const [],
      ),
      failedRules: List<String>.from(json['failedRules'] as List? ?? const []),
      explanation: json['explanation'] as String?,
      approvalStatus: json['approvalStatus'] as String?,
      paypalOrderId: json['paypalOrderId'] as String?,
      paypalStatus: json['paypalStatus'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  final String id;
  final String missionId;
  final String vendor;
  final String itemDescription;
  final double amount;
  final String currency;
  final bool isRecurring;
  final Decision decision;
  final List<String> matchedRules;
  final List<String> failedRules;
  final String? explanation;
  final String? approvalStatus;
  final String? paypalOrderId;
  final String? paypalStatus;
  final DateTime createdAt;
}
