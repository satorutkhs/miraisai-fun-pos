export type Key = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '00' | 'back' | 'clear';

const MAX = 999999;

export function keypad(value: number, key: Key): number {
  if (key === 'clear') return 0;
  if (key === 'back') return Math.floor(value / 10);
  const next = value * 10 ** key.length + Number(key);
  return next > MAX ? value : next;
}

/** 預かり金のワンタップ候補: ちょうど / 次の千円 / 5000 / 10000 (合計未満は除外・重複排除) */
export function quickAmounts(total: number): number[] {
  const nextThousand = Math.ceil(total / 1000) * 1000;
  const set = new Set<number>([total, nextThousand, 5000, 10000].filter((v) => v >= total));
  return [...set].sort((a, b) => a - b);
}
