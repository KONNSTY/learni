# Figma <-> Code (manuelles Mapping)

Code Connect per MCP (`add_code_connect_map`) setzt einen Figma-Plan mit Dev-Mode voraus; die Datei liegt im Starter-Plan. Bis dahin gilt diese Tabelle.

| Figma-Komponente (Design System) | Varianten | Code |
|---|---|---|
| `Button` | Type=Primary/Secondary/Ghost/Danger × State=Default/Disabled | `src/components/Button.tsx` (`variant`, `disabled`) |
| `OptionCard` | State=Default/Selected/Correct/Wrong/Disabled | `src/components/OptionCard.tsx` (`state`) |
| `MicButton` | State=Idle/Listening/Disabled | `src/components/MicButton.tsx` (`recording`, `disabled`) |
| `StatBar` | – | `src/components/StatBar.tsx` |
| `AvatarWithBadge` | – | `src/avatar/AvatarView.tsx` + `src/components/LanguageBadge.tsx` |
| Variablen `Color Light/Dark`, `Space`, `Radius`, `Motion` | – | `packages/tokens/tokens.json` -> `src/theme/tokens.generated.ts` |
