import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Platform, Switch, View } from "react-native";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { Text } from "../components/Text";
import { useI18n } from "../i18n";
import type { RootStackParamList } from "../navigation/types";
import { finishConsent, patchProfile } from "../state/controller";
import { useApp } from "../state/store";
import { useTheme } from "../theme";
import { isMinor } from "../ads/policy";

type Props = NativeStackScreenProps<RootStackParamList, "Consent">;
/** Einwilligungen: Sprachverarbeitung, personalisierte Werbung (nie fuer Minderjaehrige), Statistik. UMP/TCF und ATT laufen beim Ads-Init. */
export function ConsentScreen({ navigation, route }: Props) {
  const th = useTheme();
  const { t } = useI18n();
  const profile = useApp((s) => s.user?.profile);
  const settingsMode = route.params?.mode === "settings" || route.params?.mode === "voice";
  const minor = isMinor(profile?.age_bracket ?? null);
  const [voice, setVoice] = useState(profile?.consents.voice_processing ?? false);
  const [ads, setAds] = useState(!minor && (profile?.consents.personalized_ads ?? false));
  const [analytics, setAnalytics] = useState(profile?.consents.analytics ?? false);
  const Row = ({ label, hint, value, onChange, id, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; id: string; disabled?: boolean }) => (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: th.space.md, backgroundColor: th.colors.surface, borderRadius: th.radius.md, gap: 12, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flex: 1, gap: 2 }}><Text weight="medium">{label}</Text>{hint ? <Text variant="caption" color="textMuted">{hint}</Text> : null}</View>
      <Switch testID={id} accessibilityLabel={label} value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: th.colors.success, false: th.colors.border }} />
    </View>
  );
  const save = async (accept: boolean) => {
    const c = accept ? { voice_processing: voice, personalized_ads: ads && !minor, analytics } : { voice_processing: false, personalized_ads: false, analytics: false };
    if (settingsMode) { await patchProfile({ consents: c }); navigation.goBack(); } else await finishConsent(c);
  };
  return (
    <Screen scroll>
      <View style={{ flex: 1, gap: th.space.md }}>
        <Text variant="title">{t("consent.title")}</Text>
        <Text color="textMuted">{t("consent.body")}</Text>
        <Row id="consent-voice" label={t("consent.voice")} value={voice} onChange={setVoice} />
        <Row id="consent-ads" label={t("consent.ads")} hint={t("consent.adsHint")} value={ads} onChange={setAds} disabled={minor} />
        <Row id="consent-analytics" label={t("consent.analytics")} value={analytics} onChange={setAnalytics} />
        {Platform.OS === "ios" && !settingsMode && (
          <View style={{ padding: th.space.md, borderRadius: th.radius.md, backgroundColor: th.colors.surfaceAlt, gap: 4 }}>
            <Text weight="bold">{t("consent.att.title")}</Text><Text variant="caption" color="textMuted">{t("consent.att.body")}</Text>
          </View>
        )}
      </View>
      <View style={{ gap: th.space.sm, marginTop: th.space.lg }}>
        <Button testID="consent-accept" label={t("consent.accept")} onPress={() => void save(true)} />
        <Button testID="consent-necessary" label={t("consent.necessary")} variant="secondary" onPress={() => void save(false)} />
        {settingsMode && <Button variant="ghost" label={t("common.cancel")} onPress={() => navigation.goBack()} />}
      </View>
    </Screen>
  );
}
