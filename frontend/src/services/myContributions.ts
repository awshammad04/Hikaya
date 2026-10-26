/**
 * Memories a guest sent from this device, by reference code.
 *
 * Signed-in contributors see their submissions from the API; a guest used to
 * have only the code on the receipt, and losing it meant losing track of the
 * memory. The codes are kept here so the passport can show each one's review
 * status. Only the code, title, place and date are stored, never the text.
 */
export interface RememberedContribution {
  referenceCode: string;
  title: string;
  locationId: string;
  submittedAt: string;
}

const KEY = "hikaya.my-contributions";
const LIMIT = 50;

export function rememberedContributions(): RememberedContribution[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is RememberedContribution => typeof item?.referenceCode === "string")
      : [];
  } catch {
    return [];
  }
}

export function rememberContribution(item: RememberedContribution) {
  const others = rememberedContributions().filter((entry) => entry.referenceCode !== item.referenceCode);
  try {
    window.localStorage.setItem(KEY, JSON.stringify([item, ...others].slice(0, LIMIT)));
  } catch {
    // The receipt still shows the code; it just will not be listed later.
  }
}
