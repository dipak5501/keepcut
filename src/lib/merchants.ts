import type { Category } from './types';

export interface KnownMerchant {
  name: string;
  category: Category;
  /** Matched against the upper-cased raw transaction description. */
  pattern: RegExp;
}

/**
 * Common subscription merchants and how they tend to appear on statements. Brand names are
 * used only to recognise transactions; no logos or proprietary content are bundled.
 */
export const KNOWN_MERCHANTS: readonly KnownMerchant[] = [
  // AI tools
  { name: 'ChatGPT', category: 'AI tools', pattern: /\bOPENAI\b|\bCHATGPT\b/ },
  { name: 'Claude', category: 'AI tools', pattern: /\bANTHROPIC\b|\bCLAUDE(\.AI)?\b/ },
  { name: 'Perplexity', category: 'AI tools', pattern: /\bPERPLEXITY\b/ },
  {
    name: 'Gemini / Google AI',
    category: 'AI tools',
    pattern: /\bGEMINI\b(?!\s*(EXCHANGE|TRUST))|GOOGLE\s*\*?\s*(ONE\s*AI|AI\s*PRO)/,
  },
  { name: 'Cursor', category: 'AI tools', pattern: /\bCURSOR\b(\s*(AI|USAGE|PRO|IDE))?/ },
  { name: 'GitHub Copilot', category: 'AI tools', pattern: /\bGITHUB\b/ },
  { name: 'Midjourney', category: 'AI tools', pattern: /\bMIDJOURNEY\b/ },
  { name: 'Grammarly', category: 'AI tools', pattern: /\bGRAMMARLY\b/ },
  // Streaming video
  { name: 'Netflix', category: 'Streaming', pattern: /\bNETFLIX\b/ },
  { name: 'Hulu', category: 'Streaming', pattern: /\bHULU\b/ },
  { name: 'Disney+', category: 'Streaming', pattern: /\bDISNEY\s*(PLUS|\+)|DISNEYPLUS/ },
  { name: 'Max', category: 'Streaming', pattern: /\bHBO\s*MAX\b|\bMAX\.COM\b|\bHBOMAX\b/ },
  { name: 'Paramount+', category: 'Streaming', pattern: /\bPARAMOUNT\s*(PLUS|\+)?/ },
  { name: 'Peacock', category: 'Streaming', pattern: /\bPEACOCK\b/ },
  { name: 'YouTube Premium', category: 'Streaming', pattern: /\bYOUTUBE\b|GOOGLE\s*\*?\s*YOUTUBE/ },
  { name: 'Crunchyroll', category: 'Streaming', pattern: /\bCRUNCHYROLL\b/ },
  // Music & audio
  { name: 'Spotify', category: 'Music & audio', pattern: /\bSPOTIFY\b/ },
  { name: 'Tidal', category: 'Music & audio', pattern: /\bTIDAL\b/ },
  { name: 'Deezer', category: 'Music & audio', pattern: /\bDEEZER\b/ },
  { name: 'SiriusXM', category: 'Music & audio', pattern: /\bSIRIUS\s*XM\b|\bSIRIUSXM\b/ },
  { name: 'Audible', category: 'Music & audio', pattern: /\bAUDIBLE\b/ },
  // Software
  {
    name: 'Microsoft 365',
    category: 'Software',
    pattern: /\bMICROSOFT\s*\*?\s*(365|OFFICE)|\bMSFT\s*\*/,
  },
  { name: 'Adobe', category: 'Software', pattern: /\bADOBE\b/ },
  { name: 'Canva', category: 'Software', pattern: /\bCANVA\b/ },
  { name: 'Notion', category: 'Software', pattern: /\bNOTION\b/ },
  { name: '1Password', category: 'Software', pattern: /\b1PASSWORD\b/ },
  { name: 'NordVPN', category: 'Software', pattern: /\bNORDVPN\b|\bNORD\s*SEC/ },
  { name: 'ExpressVPN', category: 'Software', pattern: /\bEXPRESSVPN\b/ },
  { name: 'Zoom', category: 'Software', pattern: /\bZOOM\.US\b|\bZOOM\s*VIDEO/ },
  // Cloud storage
  { name: 'Dropbox', category: 'Cloud storage', pattern: /\bDROPBOX\b/ },
  {
    name: 'Google One',
    category: 'Cloud storage',
    pattern: /GOOGLE\s*\*?\s*(ONE|STORAGE)\b(?!\s*AI)/,
  },
  { name: 'iCloud+', category: 'Cloud storage', pattern: /\bICLOUD\b/ },
  // Must come after iCloud+ so explicit iCloud lines win over the generic Apple biller.
  {
    name: 'Apple (App Store & iCloud)',
    category: 'Software',
    pattern: /\bAPPLE\.COM\s*\/?\s*BILL\b|\bITUNES\b/,
  },
  // News & reading
  {
    name: 'The New York Times',
    category: 'News & reading',
    pattern: /\bNYTIMES\b|\bNY\s*TIMES\b|NEW\s*YORK\s*TIMES/,
  },
  {
    name: 'The Wall Street Journal',
    category: 'News & reading',
    pattern: /\bWSJ\b|WALL\s*STREET\s*JOURNAL|DOW\s*JONES/,
  },
  { name: 'Medium', category: 'News & reading', pattern: /\bMEDIUM\.COM\b|\bMEDIUM\s*MEMBER/ },
  { name: 'Substack', category: 'News & reading', pattern: /\bSUBSTACK\b/ },
  { name: 'Patreon', category: 'News & reading', pattern: /\bPATREON\b/ },
  { name: 'Kindle Unlimited', category: 'News & reading', pattern: /\bKINDLE\b/ },
  // Fitness & health
  { name: 'Peloton', category: 'Fitness & health', pattern: /\bPELOTON\b/ },
  { name: 'Strava', category: 'Fitness & health', pattern: /\bSTRAVA\b/ },
  { name: 'Planet Fitness', category: 'Fitness & health', pattern: /\bPLANET\s*FIT/ },
  { name: 'Headspace', category: 'Fitness & health', pattern: /\bHEADSPACE\b/ },
  { name: 'Calm', category: 'Fitness & health', pattern: /\bCALM\.COM\b|\bCALM\s*APP\b/ },
  // Gaming
  { name: 'Xbox Game Pass', category: 'Gaming', pattern: /\bXBOX\b/ },
  { name: 'PlayStation Plus', category: 'Gaming', pattern: /\bPLAYSTATION\b|\bSONY\s*INTERACTIVE/ },
  { name: 'Nintendo Switch Online', category: 'Gaming', pattern: /\bNINTENDO\b/ },
  // Shopping & delivery
  {
    name: 'Amazon Prime',
    category: 'Shopping & delivery',
    pattern: /\bPRIME\s*VIDEO\b|\bAMAZON\s*PRIME\b|\bAMZN\s*PRIME\b|PRIME\s*MEMBERSHIP/,
  },
  { name: 'Uber One', category: 'Shopping & delivery', pattern: /\bUBER\s*ONE\b/ },
  { name: 'DashPass', category: 'Shopping & delivery', pattern: /\bDASHPASS\b/ },
  {
    name: 'Instacart+',
    category: 'Shopping & delivery',
    pattern: /\bINSTACART\s*\+|INSTACART\s*PLUS/,
  },
  { name: 'Walmart+', category: 'Shopping & delivery', pattern: /\bWALMART\s*(\+|PLUS)/ },
  // Education
  { name: 'Duolingo', category: 'Education', pattern: /\bDUOLINGO\b/ },
  { name: 'Coursera', category: 'Education', pattern: /\bCOURSERA\b/ },
  { name: 'LinkedIn Premium', category: 'Education', pattern: /\bLINKEDIN\b/ },
  { name: 'MasterClass', category: 'Education', pattern: /\bMASTERCLASS\b/ },
];

export function matchKnownMerchant(description: string): KnownMerchant | undefined {
  const upper = description.toUpperCase();
  return KNOWN_MERCHANTS.find((m) => m.pattern.test(upper));
}

const NOISE_PREFIXES = [
  /^(POS|ACH|CHECKCARD|CHECK CARD|VISA|MC|DEBIT|CREDIT)\s+(PURCHASE|DEBIT|CARD|PMT|PAYMENT|WITHDRAWAL)?\s*/,
  /^(DEBIT|CREDIT) CARD (PURCHASE|PAYMENT)\s*/,
  /^CARD (PURCHASE|PAYMENT)( WITH PIN)?\s*/,
  /^PURCHASE AUTHORIZED ON \d{1,2}\/\d{1,2}\s*/,
  /^RECURRING (PAYMENT|CHARGE|DEBIT)\s*/,
  /^(ONLINE|INTERNET) (PAYMENT|PURCHASE|TRANSFER)\s*/,
  /^PREAUTHORIZED (DEBIT|PAYMENT)\s*/,
  /^DIRECT DEBIT\s*/,
  /^(SQ|TST|SP|PP|PAYPAL|DD|IN|PY)\s*\*\s*/,
];

/** Cleans a raw description to a readable merchant name, e.g. "SQ *BLUE BOTTLE 0423 OAKLAND CA" → "Blue Bottle". */
export function cleanMerchantName(description: string): string {
  let s = description.toUpperCase().replace(/\s+/g, ' ').trim();
  for (let pass = 0; pass < 2; pass++) {
    for (const re of NOISE_PREFIXES) s = s.replace(re, '');
  }
  s = s
    .replace(/\bHTTPS?:\/\/|\bWWW\./g, '')
    .replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, ' ') // dates
    .replace(/\+?\d[\d\s().-]{6,}\d/g, ' ') // phone / reference numbers
    .replace(/#\s*\w+/g, ' ')
    .replace(/\b[A-Z]*\d[A-Z\d]{3,}\b/g, ' ') // alphanumeric reference codes
    .replace(/\*.*$/, (m) => ' ' + m.slice(1)) // "NETFLIX*STANDARD" → "NETFLIX STANDARD"
    .replace(/\.(COM|NET|IO|AI|CO|APP|ORG)\b/g, '')
    .replace(/[^A-Z0-9&+' ]/g, ' ')
    .replace(/\s+[A-Z]{2}$/, '') // trailing US state code
    .replace(/\s+/g, ' ')
    .trim();

  const words = s.split(' ').filter(Boolean).slice(0, 3);
  if (words.length === 0) return description.trim().slice(0, 40) || 'Unknown merchant';
  return words
    .map((w) => (w.length <= 2 && w !== 'OF' ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(' ');
}

/** Stable grouping key for a transaction description. Known merchants collapse to one key. */
export function merchantKeyFor(description: string): string {
  const known = matchKnownMerchant(description);
  if (known) return `known:${known.name.toLowerCase()}`;
  return cleanMerchantName(description)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
