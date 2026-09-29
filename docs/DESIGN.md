# Design

**Figma-Datei:** https://www.figma.com/design/tKQ47NKfbESKwNgBt8kVPy (Datei „Learni – KI-Sprachtutor Design“, File-Key `tKQ47NKfbESKwNgBt8kVPy`)

| Seite | Inhalt |
|---|---|
| Design System | Komponenten-Sets: `Button` (Primary/Secondary/Ghost/Danger × Default/Disabled), `OptionCard` (Default/Selected/Correct/Wrong/Disabled), `MicButton` (Idle/Listening/Disabled), `StatBar`, `AvatarWithBadge` |
| Screens | 35 Screens: 01 Loading … 11 Profil, 12–15 Paywall je Trigger, 16 Herzen-leer-Sheet, 17 Aussprache-Report, 18 Lektionsende, 19 Streak, 20 Level-Up, 21 Konto löschen, 22–25 Consent/ATT/Altersgate/KI-Hinweis, 30–39 Übungsformate mit Zuständen |
| Prototype & Sound | Prototyp-Hinweis, Soundkonzept-Tabelle, Motion/Haptik/Reduce-Motion-Tabelle |

Klickbarer Prototyp: Seite „Screens“, Flow „App-Start bis Hauptscreen“.

## Tokens
Quelle: `packages/tokens/tokens.json`. In Figma als Variablen-Collections `Color Light`, `Color Dark`, `Space`, `Radius`, `Motion Normal (ms)`, `Motion Reduce (ms)` (Starter-Plan: 1 Modus je Collection). Im Code: `apps/mobile/src/theme` (Light/Dark/Reduce-Motion).

## Regeln
- Keine Länderflaggen als alleiniges Sprachsymbol: Sprach-Badge zeigt Kürzel + Name.
- Hauptscreen: oben links Speaker-Toggle, oben rechts Profil; oberes Drittel Avatar mit rundem Sprach-Badge; Untertitel mit Übersetzungs-Toggle; unten Antworten, Mikrofon, Wiederholen, Langsamer; ganz unten Herzen, Tagesziel, Streak.
- Sprechfehler kosten keine Herzen (auch im UI-Text kommuniziert).
- Sichtbarer KI-Hinweis im Onboarding, Hauptscreen und in den Einstellungen.
- Kontrast: Text auf Fläche ≥ 4,5:1 (Tokens so gewählt); Touch-Ziele ≥ 44 pt.

## Code-Connect
`mcp__Figma__add_code_connect_map` erfordert einen Figma-Plan mit Dev-Mode-Zugriff; Mapping-Tabelle siehe `apps/mobile/figma.code-connect.md` (manuell gepflegt, Komponentenname ↔ Datei).
