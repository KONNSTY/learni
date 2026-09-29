import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import type { TutorProfile } from "../api/types";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { Text } from "../components/Text";
import { useI18n } from "../i18n";
import type { RootStackParamList } from "../navigation/types";
import { useApp } from "../state/store";
import { useTheme } from "../theme";

/** KI-Nutzerprofil: einsehbar und loeschbar. Nur aus Lernverhalten und eigenen Angaben, keine Emotionserkennung. */
export function TutorProfileScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "TutorProfile">) {
  const th = useTheme();
  const { t } = useI18n();
  const api = useApp((s) => s.api)!;
  const language = useApp((s) => s.language)!;
  const [p, setP] = useState<TutorProfile | null>(null);
  const [deleted, setDeleted] = useState(false);
  const load = useCallback(async () => setP(await api.tutorProfile(language)), [api, language]);
  useEffect(() => { void load(); }, [load]);
  const empty = !p || (!p.typical_mistakes.length && !p.interests.length);
  return (
    <Screen scroll>
      <View style={{ flex: 1, gap: th.space.md }}>
        <Text variant="title">{t("tutorProfile.title")}</Text>
        {p && <View style={{ padding: th.space.md, borderRadius: th.radius.md, backgroundColor: th.colors.surface, gap: 6 }}>
          <Text>goals: {p.goals.join(", ") || "–"}</Text><Text>interests: {p.interests.join(", ") || "–"}</Text><Text>typical mistakes: {p.typical_mistakes.join(", ") || "–"}</Text><Text>pace: {p.pace}</Text>
        </View>}
        {empty && <Text color="textMuted">{t("tutorProfile.empty")}</Text>}
        {deleted && <Text color="success" accessibilityLiveRegion="polite">{t("tutorProfile.deleted")}</Text>}
      </View>
      <View style={{ gap: th.space.sm }}>
        <Button testID="tutor-delete" variant="danger" label={t("tutorProfile.delete")} onPress={async () => { await api.deleteTutorProfile(language); setDeleted(true); await load(); }} />
        <Button variant="secondary" label={t("common.close")} onPress={() => navigation.goBack()} />
      </View>
    </Screen>
  );
}
