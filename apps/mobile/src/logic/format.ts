export const formatMoney = (amount: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", { style: "currency", currency }).format(amount);
export const formatNumber = (n: number, locale: string, digits = 1) =>
  new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: digits }).format(n);
