import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mobile/main.dart';

void main() {
  testWidgets('App boots to the connect screen when no server is configured', (
    WidgetTester tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const PalpayRailApp());
    await tester.pumpAndSettle();

    expect(find.text('Palpay Rail'), findsOneWidget);
    expect(find.text('Connect'), findsOneWidget);
  });
}
