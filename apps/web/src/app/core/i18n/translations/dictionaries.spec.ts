import { en } from './en';
import { ar } from './ar';

function keysOf(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') {
    return [prefix];
  }

  const record = value as Record<string, unknown>;
  return Object.keys(record).flatMap((key) => keysOf(record[key], prefix === '' ? key : `${prefix}.${key}`));
}

describe('the translation dictionaries', () => {
  it('gives Arabic exactly the keys English has, no more and no fewer', () => {
    expect(keysOf(ar).sort()).toEqual(keysOf(en).sort());
  });

  it('never leaves an English string empty', () => {
    for (const key of keysOf(en)) {
      const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], en);
      expect(typeof value === 'string' && value.trim().length > 0, `${key} is empty`).toBe(true);
    }
  });

  it('never leaves an Arabic string empty', () => {
    for (const key of keysOf(ar)) {
      const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], ar);
      expect(typeof value === 'string' && value.trim().length > 0, `${key} is empty`).toBe(true);
    }
  });
});
