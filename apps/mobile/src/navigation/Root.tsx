import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { AgeGateScreen } from "../screens/AgeGateScreen";
import { AiNoticeScreen } from "../screens/AiNoticeScreen";
import { CelebrationScreen } from "../screens/CelebrationScreen";
import { ConsentScreen } from "../screens/ConsentScreen";
import { DeleteAccountScreen } from "../screens/DeleteAccountScreen";
import { LanguageSelectScreen } from "../screens/LanguageSelectScreen";
import { LessonEndScreen } from "../screens/LessonEndScreen";
import { LoadingScreen } from "../screens/LoadingScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { MainScreen } from "../screens/MainScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { PaywallScreen } from "../screens/PaywallScreen";
import { PlanScreen } from "../screens/PlanScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { PronReportScreen } from "../screens/PronReportScreen";
import { TutorProfileScreen } from "../screens/TutorProfileScreen";
import { useI18n } from "../i18n";
import { boot, loadThemePrefs } from "../state/controller";
import { useApp } from "../state/store";
import { useTheme, useThemeMode } from "../theme";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();
export type Gate = "login" | "ai" | "language" | "age" | "consent" | "onboarding" | "plan" | "main";

/** Reihenfolge der Pflichtschritte (rein, getestet): Login -> KI-Hinweis -> Sprache -> Alter -> Einwilligung -> Onboarding -> Plan -> Haupt. */
export function gateFor(s: { signedIn: boolean; aiNoticeAck: boolean; language: string | null; ageKnown: boolean; consentDone: boolean; plan: unknown; onboarded: boolean }): Gate {
  if (!s.signedIn) return "login";
  if (!s.aiNoticeAck) return "ai";
  if (!s.language) return "language";
  if (!s.ageKnown) return "age";
  if (!s.consentDone) return "consent";
  if (!s.onboarded) return s.plan ? "plan" : "onboarding";
  return "main";
}

export function Root() {
  const th = useTheme();
  const { setMode } = useThemeMode();
  const { setLocale } = useI18n();
  const booted = useApp((s) => s.booted);
  const signedIn = useApp((s) => s.signedIn);
  const aiNoticeAck = useApp((s) => s.aiNoticeAck);
  const language = useApp((s) => s.language);
  const ageKnown = useApp((s) => !!s.user?.profile.age_bracket);
  const consentDone = useApp((s) => s.consentDone);
  const plan = useApp((s) => s.plan);
  const onboarded = useApp((s) => s.onboarded);
  const uiLang = useApp((s) => s.user?.profile.ui_language);
  const [minSplash, setMinSplash] = useState(false);

  useEffect(() => { void boot(); void loadThemePrefs().then(setMode); const id = setTimeout(() => setMinSplash(true), 700); return () => clearTimeout(id); }, [setMode]);
  useEffect(() => { if (uiLang) setLocale(uiLang); }, [uiLang, setLocale]);

  if (!booted || !minSplash) return <LoadingScreen />;
  const gate = gateFor({ signedIn, aiNoticeAck, language, ageKnown, consentDone, plan, onboarded });
  const navTheme = { ...(th.scheme === "dark" ? DarkTheme : DefaultTheme), colors: { ...(th.scheme === "dark" ? DarkTheme : DefaultTheme).colors, background: th.colors.bg, card: th.colors.surface, text: th.colors.text, primary: th.colors.primary, border: th.colors.border } };
  const anim = th.reduceMotion ? ("none" as const) : ("default" as const);

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: anim === "none" ? "none" : "default", contentStyle: { backgroundColor: th.colors.bg } }}>
        {gate === "login" && <Stack.Screen name="Login" component={LoginScreen} />}
        {gate === "ai" && <Stack.Screen name="AiNotice" component={AiNoticeScreen} />}
        {gate === "language" && <Stack.Screen name="Language" component={LanguageSelectScreen} />}
        {gate === "age" && <Stack.Screen name="AgeGate" component={AgeGateScreen} />}
        {gate === "consent" && <Stack.Screen name="Consent" component={ConsentScreen} />}
        {gate === "onboarding" && <Stack.Screen name="Onboarding" component={OnboardingScreen} />}
        {gate === "plan" && <Stack.Screen name="Plan" component={PlanScreen} />}
        {gate === "main" && (
          <>
            <Stack.Screen name="Main" component={MainScreen} />
            <Stack.Group screenOptions={{ presentation: "modal", animation: anim === "none" ? "none" : "slide_from_bottom" }}>
              <Stack.Screen name="Language" component={LanguageSelectScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="Consent" component={ConsentScreen} />
              <Stack.Screen name="Paywall" component={PaywallScreen} />
              <Stack.Screen name="PronReport" component={PronReportScreen} />
              <Stack.Screen name="TutorProfile" component={TutorProfileScreen} />
              <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
              <Stack.Screen name="LessonEnd" component={LessonEndScreen} options={{ gestureEnabled: false }} />
              <Stack.Screen name="Celebration" component={CelebrationScreen} options={{ gestureEnabled: false }} />
            </Stack.Group>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
