import "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "./src/ErrorBoundary";
import { FeedbackProvider } from "./src/feedback/FeedbackProvider";
import { I18nProvider } from "./src/i18n";
import { Root } from "./src/navigation/Root";
import { ThemeProvider } from "./src/theme";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <I18nProvider>
            <ThemeProvider>
              <FeedbackProvider>
                <StatusBar style="auto" />
                <Root />
              </FeedbackProvider>
            </ThemeProvider>
          </I18nProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
