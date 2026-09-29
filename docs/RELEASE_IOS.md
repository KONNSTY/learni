# Release iOS: Expo Go / Dev Client jetzt, TestFlight später

## Jetzt: Test auf dem iPhone
1. **Expo Go** (App Store) → `cd apps/mobile && npm install && npx expo start` → QR-Code scannen. Läuft im lokalen Mock-Modus (Testmodus).
2. Mit Backend: `EXPO_PUBLIC_API_URL=http://<LAN-IP>:8000`, `EXPO_PUBLIC_API_MODE=http`, API mit `--host 0.0.0.0`.
3. **Dev Client** (für Rive, AdMob, RevenueCat, Apple-Login): siehe `docs/SETUP_ANLEITUNG.md`, Abschnitt „Dev Client“.

## Später: TestFlight
**Voraussetzungen:** Apple-Developer-Konto, App in App Store Connect angelegt, Bundle-ID festgelegt.

| Punkt | Wert / Hinweis |
|---|---|
| Bundle-ID | `app.learni.mobile` **[ANNAHME]**, per `IOS_BUNDLE_ID` änderbar (`app.config.ts`) |
| Signing | EAS verwaltet Zertifikate/Profile automatisch (`eas credentials`) oder manuell in Xcode (Team wählen, „Automatically manage signing“) |
| Capabilities | Sign in with Apple, Push nicht nötig, Microphone-Nutzung |
| Berechtigungstexte | `NSMicrophoneUsageDescription`, `NSUserTrackingUsageDescription` (in `app.config.ts`, DE) – für EN lokalisieren (`InfoPlist.strings`) |
| Export-Compliance | `ITSAppUsesNonExemptEncryption=false` (nur Standard-TLS) |

**Variante A – EAS:**
```bash
npm install -g eas-cli && eas login
cd apps/mobile && eas build:configure
eas build --profile production --platform ios
eas submit --platform ios            # lädt nach App Store Connect / TestFlight
```
Env für den Build als EAS-Secrets/Env setzen (`EXPO_PUBLIC_*`, `ADMOB_IOS_APP_ID`, `IOS_BUNDLE_ID`, `EAS_PROJECT_ID`). **Keine** Server-Secrets in EAS-Env der App.

**Variante B – Xcode-Archiv:**
```bash
cd apps/mobile && npx expo prebuild --platform ios --clean
open ios/*.xcworkspace              # Scheme Release, Any iOS Device → Product → Archive → Distribute App → TestFlight
```
(`ios/` und `android/` sind in `.gitignore`, prebuild erzeugt sie reproduzierbar.)

## Datenschutzangaben (App Store „App-Datenschutz“)
- Erhobene Daten: Kontakt (E-Mail, falls E-Mail-Login), Nutzer-ID, Nutzungsdaten (Lernfortschritt, Analytics nur mit Einwilligung), Audio-Daten (**nur flüchtig verarbeitet, nicht gespeichert**), Käufe, Werbedaten (AdMob, nur mit Einwilligung personalisiert).
- Tracking: nur mit ATT-Zustimmung; Minderjährige nie personalisiert.
- Datenschutzerklärung-URL und Support-URL bereitstellen (`docs/LEGAL_TODO.md`).

## App-Review-Hinweise
- **Demo-Zugang** bereitstellen (Sign in with Apple ist Pflicht-Login; Reviewer nutzen ihre eigene Apple-ID).
- Hinweis: „Der Tutor ist eine KI (sichtbarer Hinweis im Onboarding und Hauptscreen). Es findet keine Emotionserkennung statt.“
- **Konto-Löschung** in der App: Profil → „Konto löschen“ (Richtlinie 5.1.1(v)).
- **Abo:** Preis, Laufzeit, Trial und Kündigungshinweis stehen auf der Paywall; „Käufe wiederherstellen“ vorhanden.
- **Werbung:** freiwillige Rewarded Ads, nie mitten im Sprechfluss, nicht für Pro; UMP/ATT-Abfrage vor personalisierter Werbung.
- Mikrofon: Begründungstext, App bleibt ohne Mikrofon nutzbar (Tipp-Alternative).

## Android (vorbereitet, nicht getestet)
`package` in `app.config.ts` (`ANDROID_PACKAGE`), `eas build --platform android`, Google-Play-Billing über RevenueCat (`EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`), AdMob-Android-IDs. Aufnahme nutzt dort AAC/M4A (`audio/mp4`), der Server akzeptiert beides.
