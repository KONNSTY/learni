// Adaptive Einstufungsfragen (2-3 Stueck): Wort der Zielsprache -> richtige Uebersetzung waehlen.
// item_ids passen zu content/packs/<lang>/a1_basics.json, damit das Backend sie zuordnen kann.
type Row = [key: string, lemma: string, de: string, en: string];
const WORDS: Record<string, Row[]> = {
  es: [["hello", "hola", "hallo", "hello"], ["water", "agua", "Wasser", "water"], ["house", "casa", "Haus", "house"], ["bread", "pan", "Brot", "bread"], ["dog", "perro", "Hund", "dog"]],
  en: [["hello", "hello", "hallo", "hello"], ["water", "water", "Wasser", "water"], ["house", "house", "Haus", "house"], ["bread", "bread", "Brot", "bread"], ["dog", "dog", "Hund", "dog"]],
  fr: [["hello", "bonjour", "hallo", "hello"], ["water", "eau", "Wasser", "water"], ["house", "maison", "Haus", "house"], ["bread", "pain", "Brot", "bread"], ["dog", "chien", "Hund", "dog"]],
  hr: [["hello", "bok", "hallo", "hello"], ["water", "voda", "Wasser", "water"], ["house", "kuća", "Haus", "house"], ["bread", "kruh", "Brot", "bread"], ["dog", "pas", "Hund", "dog"]],
  id: [["hello", "halo", "hallo", "hello"], ["water", "air", "Wasser", "water"], ["house", "rumah", "Haus", "house"], ["bread", "roti", "Brot", "bread"], ["dog", "anjing", "Hund", "dog"]],
  tr: [["hello", "merhaba", "hallo", "hello"], ["water", "su", "Wasser", "water"], ["house", "ev", "Haus", "house"], ["bread", "ekmek", "Brot", "bread"], ["dog", "köpek", "Hund", "dog"]],
};
export interface OnbQuestion { item_id: string; word: string; options: string[]; answer: string }

export function buildQuestions(lang: string, ui: "de" | "en", count = 3): OnbQuestion[] {
  const rows = WORDS[lang] ?? WORDS.es;
  const tr = (r: Row) => (ui === "de" ? r[2] : r[3]);
  return rows.slice(0, count).map((r, i) => {
    const distract = rows.filter((x) => x[0] !== r[0]).map(tr).slice(i, i + 2);
    const options = [tr(r), ...distract].sort((a, b) => a.localeCompare(b));
    return { item_id: `${lang}.${r[0]}`, word: r[1], options, answer: tr(r) };
  });
}
export const hasQuestionBank = (lang: string) => lang in WORDS;
