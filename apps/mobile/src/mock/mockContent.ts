// Kleiner Demo-Content fuer den lokalen Mock-Modus (Expo Go ohne Backend). Spiegelt content/packs/es (draft -> Testmodus).
export interface MockItem { id: string; lemma: string; de: string; en: string }
export const ITEMS: MockItem[] = [
  { id: "es.hello", lemma: "hola", de: "hallo", en: "hello" },
  { id: "es.thanks", lemma: "gracias", de: "danke", en: "thank you" },
  { id: "es.please", lemma: "por favor", de: "bitte", en: "please" },
  { id: "es.water", lemma: "agua", de: "Wasser", en: "water" },
  { id: "es.coffee", lemma: "café", de: "Kaffee", en: "coffee" },
  { id: "es.milk", lemma: "leche", de: "Milch", en: "milk" },
  { id: "es.bread", lemma: "pan", de: "Brot", en: "bread" },
  { id: "es.house", lemma: "casa", de: "Haus", en: "house" },
  { id: "es.cat", lemma: "gato", de: "Katze", en: "cat" },
  { id: "es.dog", lemma: "perro", de: "Hund", en: "dog" },
];
export const SENTENCES = [
  { text: "Quiero un café", tokens: ["Quiero", "un", "café"], de: "Ich möchte einen Kaffee", en: "I would like a coffee" },
  { text: "Agua, por favor", tokens: ["Agua,", "por", "favor"], de: "Wasser, bitte", en: "Water, please" },
];
export const BLANKS = [{ sentence: "Yo ___ un café.", answer: "quiero", options: ["quiero", "quieres", "quiere"], de: "Ich möchte einen Kaffee.", en: "I would like a coffee." }];
export const DIALOG = [
  { say: "¡Hola! ¿Cómo te llamas?", type: "none" as const },
  { say: "Mucho gusto. ¿Qué quieres beber?", type: "multiple_choice" as const, options: ["Un café", "Un coche", "Una casa"], expected: "Un café" },
  { say: "¡Muy bien! Repite: Quiero un café.", type: "speak_repeat" as const, expected: "Quiero un café" },
  { say: "¡Excelente! Hasta luego.", type: "none" as const },
];
