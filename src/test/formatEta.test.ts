import { formatEta } from '../utils/formatEta';

describe('formatEta', () => {
  it('returns "0s" for zero seconds', () => {
    expect(formatEta(0)).toBe('0s');
  });

  it('clamps negative values to 0', () => {
    expect(formatEta(-10)).toBe('0s');
  });

  it('formats seconds under a minute', () => {
    expect(formatEta(1)).toBe('1s');
    expect(formatEta(42)).toBe('42s');
    expect(formatEta(59)).toBe('59s');
  });

  it('formats minutes and seconds', () => {
    expect(formatEta(60)).toBe('1m 0s');
    expect(formatEta(61)).toBe('1m 1s');
    expect(formatEta(192)).toBe('3m 12s');
    expect(formatEta(3599)).toBe('59m 59s');
  });

  it('formats hours and minutes', () => {
    expect(formatEta(3600)).toBe('1h 0m');
    expect(formatEta(3661)).toBe('1h 1m');
    expect(formatEta(8100)).toBe('2h 15m');
    expect(formatEta(86400)).toBe('24h 0m');
  });

  it('rounds fractional seconds', () => {
    expect(formatEta(0.4)).toBe('0s');
    expect(formatEta(0.6)).toBe('1s');
    expect(formatEta(59.9)).toBe('1m 0s'); // rounds to 60
  });

  it('rounds 59.5 seconds to 60 which becomes 1m', () => {
    expect(formatEta(59.5)).toBe('1m 0s');
  });
});
