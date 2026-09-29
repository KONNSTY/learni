import React from "react";
import { Pressable, Text, View } from "react-native";

/** Faengt Render-Fehler ab (kein weisser Screen). Keine sensiblen Daten in der Anzeige oder in Logs. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* bewusst kein console.log mit Nutzerdaten */ }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "700" }}>Etwas ist schiefgelaufen / Something went wrong</Text>
        <Pressable accessibilityRole="button" onPress={() => this.setState({ failed: false })} style={{ padding: 14, borderRadius: 12, backgroundColor: "#2F6BFF" }}><Text style={{ color: "#fff", fontWeight: "700" }}>OK</Text></Pressable>
      </View>
    );
  }
}
