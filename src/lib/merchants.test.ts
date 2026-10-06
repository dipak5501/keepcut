import { describe, expect, it } from 'vitest';
import { cleanMerchantName, matchKnownMerchant, merchantKeyFor } from './merchants';

describe('matchKnownMerchant', () => {
  it.each([
    ['NETFLIX.COM 866-579-7172 CA', 'Netflix'],
    ['OPENAI *CHATGPT SUBSCR', 'ChatGPT'],
    ['CLAUDE.AI SUBSCRIPTION', 'Claude'],
    ['GOOGLE *Google One g.co/helppay#', 'Google One'],
    ['GOOGLE *YouTubePremium', 'YouTube Premium'],
    ['APPLE.COM/BILL 866-712-7753 CA ICLOUD', 'iCloud+'],
    ['APPLE.COM/BILL 866-712-7753 CA', 'Apple (App Store & iCloud)'],
    ['DISNEY PLUS 888-905-7888', 'Disney+'],
    ['Spotify USA', 'Spotify'],
  ])('recognises %s', (description, name) => {
    expect(matchKnownMerchant(description)?.name).toBe(name);
  });

  it('does not match unrelated merchants', () => {
    expect(matchKnownMerchant("TRADER JOE'S #552")).toBeUndefined();
    expect(matchKnownMerchant('GEMINI TRUST COMPANY')).toBeUndefined();
  });
});

describe('cleanMerchantName', () => {
  it.each([
    ['SQ *BLUE KETTLE COFFEE OAKLAND CA', 'Blue Kettle Coffee'],
    ['POS PURCHASE CITY GYM MEMBERSHIP DUES', 'City Gym Membership'],
    ['PURCHASE AUTHORIZED ON 03/14 GREENBOX MEAL KITS', 'Greenbox Meal Kits'],
    ['SHELL OIL 57442018 OAKLAND CA', 'Shell Oil Oakland'],
    ['   ', 'Unknown merchant'],
  ])('cleans %s', (raw, expected) => {
    expect(cleanMerchantName(raw)).toBe(expected);
  });
});

describe('merchantKeyFor', () => {
  it('collapses variants of the same merchant', () => {
    expect(merchantKeyFor('NETFLIX.COM 866-579-7172 CA')).toBe(merchantKeyFor('Netflix Inc'));
    expect(merchantKeyFor('CITY GYM MEMBERSHIP DUES 0301')).toBe(
      merchantKeyFor('CITY GYM MEMBERSHIP DUES 0401'),
    );
  });
});
