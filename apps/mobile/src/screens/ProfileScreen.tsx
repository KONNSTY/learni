import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { Alert, Share, Switch, View } from "react-native";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { Screen } from "../components/Screen";
import { Text } from "../components/Text";
import { env, mockAllowed } from "../config/env";
import { useI18n } from "../i18n";
import type { RootStackParamList } from "../navigation/types";
import { devSetTier, patchProfile, saveThemeMode, signOut } from "../state/controller";
import { useApp } from "../state/store";
import { useTheme, useThemeMode, type ThemeMode } from "../theme";

/** Profil und Settings: getrennte Schalter fuer Avatar-Stimme, SFX und Haptik. */
export function ProfileScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "Profile">) {
  const th = useTheme();
  const { t, locale, setLocale } = useI18n();
  const { mode, setMode } = useThemeMode();
  const user = useApp((s) => s.user);
  const api = useApp((s) => s.api);
  const s = user?.profile.settings;
  const Row = ({ label, k }: { label: string; k: "avatar_voice" | "sfx" | "haptics" | "show_translation" | "auto_vad" }) => (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: th.space.md, backgroundColor: th.colors.surface, borderRadius: th.radius.md, minHeight: 56 }}>
      <Text weight="medium" style={{ flex: 1 }}>{label}</Text>
      <Switch testID={`setting-${k}`} accessibilityLabel={label} value={!!s?.[k]} onValueChange={(v) => void patchProfile({ settings: { [k]: v } })} trackColor={{ true: th.colors.success, false: th.colors.border }} />
    </View>
  );
  const themeModes: ThemeMode[] = ["system", "light", "dark"];
  const exportData = async () => { const data = await api!.exportData(); await Share.share({ message: JSON.stringify(data, null, 2) }); };
  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text variant="title">{t("settings.title")}</Text>
        <Chip label={t("common.close")} onPress={() => navigation.goBack()} testID="profile-close" />
      </View>
      <View style={{ gap: th.space.sm, marginTop: th.space.md }}>
        <Text color="textMuted">{t("settings.membership", { tier: (user?.membership.tier ?? "free").toUpperCase() })}</Text>
        <Row label={t("settings.avatarVoice")} k="avatar_voice" />
        <Row label={t("settings.sfx")} k="sfx" />
        <Row label={t("settings.haptics")} k="haptics" />
        <Row label={t("settings.translation")} k="show_translation" />
        <Row label={t("settings.autoVad")} k="auto_vad" />
        <Text weight="bold" style={{ marginTop: th.space.sm }}>{t("settings.theme")}</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{themeModes.map((m) => <Chip key={m} label={t(`settings.theme.${m}`)} bg={mode === m ? "primary" : "surface"} fg={mode === m ? "primaryText" : "text"} onPress={() => { setMode(m); void saveThemeMode(m); }} />)}</View>
        <View style={{ flexDirection: "row", gap: 8 }}>{(["de", "en"] as const).map((l) => <Chip key={l} label={l.toUpperCase()} bg={locale === l ? "primary" : "surface"} fg={locale === l ? "primaryText" : "text"} onPress={() => { setLocale(l); void patchProfile({ ui_language: l }); }} />)}</View>
        <Button variant="secondary" label={t("settings.privacy")} onPress={() => navigation.navigate("Consent", { mode: "settings" })} />
        <Button variant="secondary" label={t("settings.tutorProfile")} onPress={() => navigation.navigate("TutorProfile")} />
        <Button variant="secondary" label={t("settings.export")} onPress={() => void exportData()} />
        {mockAllowed && env.apiMode === "mock" || __DEV__ ? <Button testID="dev-toggle-pro" variant="ghost" label={`Test: ${user?.membership.tier === "pro" ? "→ Free" : "→ Pro"}`} onPress={() => void devSetTier(user?.membership.tier === "pro" ? "free" : "pro")} /> : null}
        <Button variant="ghost" label={t("settings.signOut")} onPress={() => Alert.alert(t("settings.signOut"), undefined, [{ text: t("common.cancel"), style: "cancel" }, { text: t("settings.signOut"), onPress: () => void signOut() }])} />
        <Button testID="delete-account" variant="danger" label={t("settings.delete")} onPress={() => navigation.navigate("DeleteAccount")} />
        <Text variant="caption" color="textMuted" center>{t("ai.notice")}</Text>
      </View>
    </Screen>
  );
}
