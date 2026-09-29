import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { View } from "react-native";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { Text } from "../components/Text";
import { useI18n } from "../i18n";
import type { RootStackParamList } from "../navigation/types";
import { deleteAccount } from "../state/controller";
import { useTheme } from "../theme";

/** Konto-Loeschung in der App (App-Store-Pflicht 5.1.1(v)): entfernt Profil, Lernstand, Lernermodell und KI-Profil. */
export function DeleteAccountScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "DeleteAccount">) {
  const th = useTheme();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const run = async () => { setBusy(true); setErr(false); try { await deleteAccount(); } catch { setErr(true); setBusy(false); } };
  return (
    <Screen>
      <View style={{ flex: 1, gap: th.space.md }}>
        <Text variant="title">{t("delete.title")}</Text>
        <Text color="textMuted">{t("delete.body")}</Text>
        <View style={{ padding: th.space.md, borderRadius: th.radius.md, backgroundColor: th.colors.errorBg, borderWidth: 2, borderColor: th.colors.error }}><Text color="error" weight="bold">{t("delete.warning")}</Text></View>
        {err && <Text color="error" accessibilityLiveRegion="polite">{t("error.generic")}</Text>}
      </View>
      <View style={{ gap: th.space.sm }}>
        <Button testID="delete-confirm" variant="danger" label={t("delete.confirm")} loading={busy} onPress={() => void run()} />
        <Button variant="secondary" label={t("common.cancel")} onPress={() => navigation.goBack()} />
      </View>
    </Screen>
  );
}
