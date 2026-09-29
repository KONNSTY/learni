import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { LanguageBadge } from "../components/LanguageBadge";
import { Screen } from "../components/Screen";
import { Text } from "../components/Text";
import { useI18n } from "../i18n";
import type { RootStackParamList } from "../navigation/types";
import { chooseLanguage } from "../state/controller";
import { useApp } from "../state/store";
import { useTheme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Language">;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Sprachauswahl: Suche oben, Grid mit Zoom (3/2/1 Spalten). Icon + Sprachname, keine Flaggen. */
export function LanguageSelectScreen({ navigation, route }: Props) {
  const th = useTheme();
  const { t } = useI18n();
  const languages = useApp((s) => s.languages);
  const current = useApp((s) => s.language);
  const [q, setQ] = useState("");
  const [cols, setCols] = useState(2);
  const list = useMemo(() => languages.filter((l) => !q || norm(l.name + " " + l.native_name).includes(norm(q))), [languages, q]);
  const pick = async (code: string) => { await chooseLanguage(code); if (route.params?.mode === "switch") navigation.goBack(); };
  return (
    <Screen>
      <View style={{ flexDirection: "row", gap: th.space.sm, alignItems: "center" }}>
        <TextInput testID="language-search" value={q} onChangeText={setQ} placeholder={t("language.search")} placeholderTextColor={th.colors.textMuted} accessibilityLabel={t("language.search")}
          style={{ flex: 1, borderWidth: 1, borderColor: th.colors.border, borderRadius: th.radius.md, padding: 14, color: th.colors.text, backgroundColor: th.colors.surface, fontSize: 16 }} />
        <Chip label={`${cols}×`} accessibilityLabel={t("language.zoom")} onPress={() => setCols(cols === 3 ? 1 : cols + 1)} />
      </View>
      <Text variant="title" style={{ marginVertical: th.space.md }}>{t("language.title")}</Text>
      <ScrollView contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {list.length === 0 && <Text color="textMuted">{t("language.none")}</Text>}
        {list.map((l) => (
          <Pressable key={l.code} testID={`language-${l.code}`} accessibilityRole="button" accessibilityLabel={`${l.badge} ${l.name}`} onPress={() => void pick(l.code)}
            style={{ flexBasis: cols === 1 ? "100%" : cols === 2 ? "47%" : "30%", flexGrow: 1, padding: th.space.md, borderRadius: th.radius.md, backgroundColor: th.colors.surface, borderWidth: 2, borderColor: current === l.code ? th.colors.primary : th.colors.border, gap: 8, alignItems: cols === 1 ? "center" : "flex-start", flexDirection: cols === 1 ? "row" : "column" }}>
            <LanguageBadge badge={l.badge} size={cols === 3 ? 36 : 48} />
            <View style={{ gap: 4 }}>
              <Text weight="bold" variant={cols === 3 ? "caption" : "body"}>{l.native_name}</Text>
              {l.native_name !== l.name && <Text variant="caption" color="textMuted">{l.name}</Text>}
              {l.tier !== "A" && <Chip label={t("common.beta")} bg="surfaceAlt" fg="textMuted" />}
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <Text variant="caption" color="textMuted" center style={{ marginTop: th.space.sm }}>{t("language.hint")}</Text>
      {route.params?.mode === "switch" && <Button variant="ghost" label={t("common.cancel")} onPress={() => navigation.goBack()} />}
    </Screen>
  );
}
