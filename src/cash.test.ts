import { describe, expect, it } from 'vitest';
import { keypad, quickAmounts } from './cash';

describe('keypad', () => {
  it('数字を末尾に追加する', () => {
    expect(keypad(0, '5')).toBe(5);
    expect(keypad(5, '0')).toBe(50);
    expect(keypad(50, '00')).toBe(5000);
  });
  it('先頭の0は増えない', () => {
    expect(keypad(0, '0')).toBe(0);
    expect(keypad(0, '00')).toBe(0);
  });
  it('1文字削除とクリア', () => {
    expect(keypad(1234, 'back')).toBe(123);
    expect(keypad(5, 'back')).toBe(0);
    expect(keypad(1234, 'clear')).toBe(0);
  });
  it('桁あふれは無視する(上限999999)', () => {
    expect(keypad(99999, '9')).toBe(999999);
    expect(keypad(999999, '9')).toBe(999999);
    expect(keypad(99999, '00')).toBe(99999);
  });
});

describe('quickAmounts', () => {
  it('ちょうどと、合計以上の紙幣・硬貨の切り上げ候補を返す', () => {
    expect(quickAmounts(700)).toEqual([700, 1000, 5000, 10000]);
  });
  it('合計が1000円ちょうどなら重複しない', () => {
    expect(quickAmounts(1000)).toEqual([1000, 5000, 10000]);
  });
  it('合計が1000円超なら次の千円刻みも出す', () => {
    expect(quickAmounts(1400)).toEqual([1400, 2000, 5000, 10000]);
  });
  it('合計が5000円超でも10000は残る', () => {
    expect(quickAmounts(5200)).toEqual([5200, 6000, 10000]);
  });
});
