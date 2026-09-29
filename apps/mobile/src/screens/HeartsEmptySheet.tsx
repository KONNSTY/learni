import React, { useState } from "react";
import { View } from "react-native";
import { Button } from "../components/Button";
import { Sheet } from "../components/Sheet";
import { Text } from "../components/Text";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";

/** Herzen-leer-Sheet: Sprechen bleibt kostenlos, Rewarded Ad ist freiwillig, Pro als dritte Option. */
export function HeartsEmptySheet({ visible, onClose, onSpeak, onAd, onPro }: { visible: boolean; onClose: () => void; onSpeak: () => void; onAd: () => Promise<void>; onPro: () => void }) {
  const th = useTheme();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: th.colors.heart }} />
      <Text variant="title" center>{t("hearts.empty.title")}</Text>
      <Text color="textMuted" center>{t("hearts.empty.body")}</Text>
      <View style={{ alignSelf: "stretch", gap: th.space.sm }}>
        <Button testID="hearts-speak" label={t("hearts.empty.speak")} onPress={onSpeak} />
        <Button testID="hearts-ad" variant="secondary" label={t("hearts.empty.ad")} loading={busy} onPress={async () => { setBusy(true); try { await onAd(); } finally { setBusy(false); } }} />
        <Button testID="hearts-pro" variant="ghost" label={t("hearts.empty.pro")} onPress={onPro} />
      </View>
    </Sheet>
  );
}
