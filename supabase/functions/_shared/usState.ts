/** Canonical USPS abbreviations → full names (50 states + DC). */
export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

const BY_NAME: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(STATE_NAMES).map(([abbr, name]) => [name.toLowerCase(), abbr]),
  ),
  "district of columbia": "DC",
  "washington dc": "DC",
  "washington d c": "DC",
};

/** Country-level values — not US states; caller should pass through. */
const REJECT = new Set([
  "usa",
  "us",
  "united states",
  "united states of america",
]);

function clean(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lookup(value: string): string | null {
  const upper = value.toUpperCase();
  if (STATE_NAMES[upper]) return upper;
  return BY_NAME[value] ?? null;
}

/**
 * Convert a messy state cell to a 2-letter USPS abbreviation.
 * Returns null when the value cannot be trusted (caller should pass through).
 */
export function toStateAbbr(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = clean(raw);
  if (!value || REJECT.has(value)) return null;

  const direct = lookup(value);
  if (direct) return direct;

  const zipMatch = value.match(/\b([a-z]{2})\s+\d{5}(?:-\d{4})?\b/);
  if (zipMatch) {
    const fromZip = lookup(zipMatch[1]);
    if (fromZip) return fromZip;
  }

  const tokens = value.split(" ");
  for (let i = tokens.length; i >= 1; i--) {
    const found = lookup(tokens.slice(-i).join(" "));
    if (found) return found;
  }

  return null;
}
