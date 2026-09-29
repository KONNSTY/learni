export const formatMoney = (amount: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", { style: "currency", currency }).format(amount);
