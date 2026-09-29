import React, { useState } from "react";
import { Platform, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { Text } from "../components/Text";
import { hasSupabase } from "../config/env";
import { useI18n } from "../i18n";
import { signIn } from "../state/controller";
import { useTheme } from "../theme";

export function LoginScreen() {
  const th = useTheme();
  const { t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (p: "apple" | "google" | "email") => {
    setBusy(p); setMsg(null);
    try { const r = await signIn(p, email.trim()); if (r === "emailSent") setMsg(t("login.emailSent")); else if (r === "failed") setMsg(t("error.generic")); }
    catch { setMsg(t("error.generic")); } finally { setBusy(null); }
  };
  return (
    <Screen scroll>
      <View style={{ flex: 1, justifyContent: "flex-end", gap: th.space.md }}>
        <Text variant="display">{t("login.title")}</Text>
        <Text color="textMuted">{t("login.subtitle")}</Text>
        <View style={{ height: th.space.lg }} />
        {(Platform.OS === "ios" || !hasSupabase()) && <Button testID="login-apple" label={t("login.apple")} loading={busy === "apple"} onPress={() => run("apple")} />}
        <Button testID="login-google" label={t("login.google")} variant="secondary" loading={busy === "google"} onPress={() => run("google")} />
        {showEmail ? (
          <View style={{ gap: th.space.sm }}>
            <TextInput testID="login-email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder={t("login.emailPlaceholder")} placeholderTextColor={th.colors.textMuted}
              style={{ borderWidth: 2, borderColor: th.colors.border, borderRadius: th.radius.md, padding: 14, color: th.colors.text, backgroundColor: th.colors.surface, fontSize: 16 }} />
            <Button label={t("login.emailSend")} disabled={!hasSupabase() ? false : !email.includes("@")} loading={busy === "email"} onPress={() => run("email")} />
          </View>
        ) : <Button testID="login-email-toggle" label={t("login.email")} variant="ghost" onPress={() => (hasSupabase() ? setShowEmail(true) : run("email"))} />}
        {msg ? <Text center color="textMuted" accessibilityLiveRegion="polite">{msg}</Text> : null}
        {!hasSupabase() && <Text variant="caption" center color="textMuted">{t("login.devHint")}</Text>}
        <Text variant="caption" center color="textMuted">{t("login.terms")}</Text>
      </View>
    </Screen>
  );
}
