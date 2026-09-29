import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { View } from "react-native";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { Screen } from "../components/Screen";
import { Text } from "../components/Text";
import { useI18n } from "../i18n";
import { formatMoney } from "../logic/format";
import type { RootStackParamList } from "../navigation/types";
import { offersRewardedAd, paywallKeys } from "../paywall/triggers";
import { buyPro, dismissPaywall, getPurchases, restorePurchases, watchRewardedAd } from "../state/controller";
import { useApp } from "../state/store";
import { useTheme, type ColorName } from "../theme";

const HERO: Record<string, ColorName> = { hearts_empty: "heart", ai_minutes_exhausted: "primary", pro_feature: "xp", streak_at_risk: "streak", onboarding_plan: "primary" };

/** Paywall-Varianten je Trigger (Figma 12-15). Rewarded Ad nur bei hearts_empty und immer freiwillig. */
export function PaywallScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, "Paywall">) {
  const th = useTheme();
  const { t, locale } = useI18n();
  const trigger = route.params.trigger;
  const config = useApp((s) => s.config);
  const tier = useApp((s) => s.user?.membership.tier);
  const [busy, setBusy] = useState<string | null>(null);
  const cur = config?.pricing.currency ?? "EUR";
  const monthly = formatMoney(config?.pricing.monthly ?? 11.99, cur, locale);
  const yearly = formatMoney(config?.pricing.yearly ?? 69.99, cur, locale);
  const keys = paywallKeys(trigger);
  const close = () => { dismissPaywall(); navigation.goBack(); };
  const buy = async () => { setBusy("buy"); try { const r = await buyPro("yearly"); if (r.pro) close(); } finally { setBusy(null); } };
  const ad = async () => { setBusy("ad"); try { if (await watchRewardedAd()) close(); } finally { setBusy(null); } };
  if (tier === "pro") { setTimeout(close, 0); }
  return (
    <Screen scroll>
      <View style={{ alignItems: "flex-end" }}><Chip testID="paywall-close" label={t("common.close")} onPress={close} /></View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: th.space.md }}>
        <View style={{ width: 140, height: 140, borderRadius: 70, backgroundColor: th.colors[HERO[trigger] ?? "primary"] }} />
        <Text variant="title" center>{t(keys.title as never)}</Text>
        <Text color="textMuted" center>{t(keys.body as never)}</Text>
        <View style={{ alignSelf: "stretch", padding: th.space.md, borderRadius: th.radius.md, backgroundColor: th.colors.surface, borderWidth: 2, borderColor: th.colors.primary, gap: 4 }}>
          <Text weight="bold" center>{t("paywall.price", { monthly })}</Text>
          <Text variant="caption" color="textMuted" center>{t("paywall.priceYear", { yearly })}</Text>
        </View>
      </View>
      <View style={{ gap: th.space.sm }}>
        <Button testID="paywall-buy" label={t("paywall.cta")} loading={busy === "buy"} onPress={() => void buy()} />
        {offersRewardedAd(trigger) ? <Button testID="paywall-ad" variant="secondary" label={t("paywall.ad")} loading={busy === "ad"} onPress={() => void ad()} /> : <Button variant="secondary" label={t("common.later")} onPress={close} />}
        {getPurchases().sandbox && <Text variant="caption" color="textMuted" center>{t("paywall.sandbox")}</Text>}
        <Text variant="caption" color="textMuted" center>{t("paywall.legal")}</Text>
        <Button variant="ghost" label={t("paywall.restore")} onPress={() => void restorePurchases()} />
      </View>
    </Screen>
  );
}
