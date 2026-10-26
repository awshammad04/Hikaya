import { normalizeListedPhone, normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('reads a Palestinian mobile written the local way', () => {
    expect(normalizePhone('+970', '059 912-3456')).toBe('+970599123456');
    expect(normalizePhone('970', '599123456')).toBe('+970599123456');
  });

  it('accepts landlines and +972 numbers', () => {
    expect(normalizePhone('+970', '02 274 1234')).toBe('+97022741234');
    expect(normalizePhone('+972', '052-123-4567')).toBe('+972521234567');
  });

  it('lets a full international number override the picker', () => {
    expect(normalizePhone('+970', '+962 79 123 4567')).toBe('+962791234567');
    expect(normalizePhone('+970', '00970599123456')).toBe('+970599123456');
    // A country without its own rule only gets the overall E.164 check.
    expect(normalizePhone('+970', '+49 30 1234567')).toBe('+49301234567');
  });

  it('rejects numbers that cannot be real', () => {
    expect(normalizePhone('+970', '05991234')).toBeNull(); // one digit short
    // A mobile one digit short would otherwise pass as a landline.
    expect(normalizePhone('+970', '059 900 010')).toBeNull();
    expect(normalizePhone('+970', '02 274 12345')).toBeNull();
    expect(normalizePhone('+970', '0599123456789')).toBeNull();
    expect(normalizePhone('+970', 'call me')).toBeNull();
    expect(normalizePhone('+0', '599123456')).toBeNull();
    expect(normalizePhone('+970', '')).toBeNull();
  });

  it('reads admin lists with or without the plus', () => {
    expect(normalizeListedPhone('970599123456')).toBe('+970599123456');
    expect(normalizeListedPhone('+970 599 123 456')).toBe('+970599123456');
  });
});
