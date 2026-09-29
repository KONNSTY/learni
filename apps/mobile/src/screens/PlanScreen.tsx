import React, { useState } from "react";
import { View } from "react-native";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { Text } from "../components/Text";
import { useI18n } from "../i18n";
import { formatMoney } from "../logic/format";
import { buyPro, finishOnboarding } from "../state/controller";
import { useApp } from "../state/store";
import { useTheme } from "../theme";

/** Lernplan mit Paywall/Trial (Trigger `onboarding_plan`). */
export function PlanScreen() {
  const th = useTheme();
  const { t, locale } = useI18n();
  const plan = useApp((s) => s.plan);
  const config = useApp((s) => s.config);
  const [busy, setBusy] = useState(false);
  const cur = config?.pricing.currency ?? "EUR";
  const monthly = formatMoney(config?.pricing.monthly ?? 11.99, cur, locale);
  const yearly = formatMoney(config?.pricing.yearly ?? 69.99, cur, locale);
  const trial = async () => { setBusy(true); try { await buyPro("yearly"); } finally { setBusy(false); } await finishOnboarding(); };
  return (
    <Screen scroll>
      <View style={{ flex: 1, gap: th.space.md }}>
        <Text variant="title">{t("plan.title")}</Text>
        <Text color="textMuted">{t("plan.summary", { weeks: plan?.weeks_to_next_level ?? 8, minutes: plan?.daily_goal_minutes ?? 10 })}</Text>
        <View style={{ padding: th.space.md, borderRadius: th.radius.lg, backgroundColor: th.colors.surface, borderWidth: 2, borderColor: th.colors.primary, gap: 10 }}>
          <Text variant="bodyLg" weight="bold">{t("plan.pro.title")}</Text>
          <Text>{t("plan.pro.bullets")}</Text>
          <Text variant="caption" color="textMuted">{t("plan.pro.price", { monthly, yearly })}</Text>
        </View>
      </View>
      <View style={{ gap: th.space.sm, marginTop: th.space.lg }}>
        <Button testID="plan-trial" label={t("plan.trial")} loading={busy} onPress={() => void trial()} />
        <Button testID="plan-free" label={t("plan.free")} variant="ghost" onPress={() => void finishOnboarding()} />
        <Text variant="caption" color="textMuted" center>{t("paywall.legal")}</Text>
      </View>
    </Screen>
  );
}
