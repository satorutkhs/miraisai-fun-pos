import { beforeEach, describe, expect, it } from 'vitest';
import { createStore, type KV } from './store';
import { emptyCounts, type Counts } from './pricing';

const c = (o: Partial<Counts>): Counts => ({ ...emptyCounts(), ...o });

function memory(): KV & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

let kv: ReturnType<typeof memory>;
let t = 0;
const now = () => new Date(2026, 9, 10, 10, 0, t++);

beforeEach(() => {
  kv = memory();
  t = 0;
});

describe('store', () => {
  it('最初の伝票番号は1', () => {
    expect(createStore(kv, now).nextNumber()).toBe(1);
  });

  it('会計すると番号が進み、お釣りが計算される', () => {
    const s = createStore(kv, now);
    const o = s.checkout(c({ macchiato: 1, hotsand: 2 }), 1000);
    expect(o.no).toBe(1);
    expect(o.total).toBe(700);
    expect(o.discount).toBe(200);
    expect(o.change).toBe(300);
    expect(s.nextNumber()).toBe(2);
  });

  it('預かりが足りない/空注文は会計できない', () => {
    const s = createStore(kv, now);
    expect(() => s.checkout(c({ macchiato: 1, hotsand: 0 }), 200)).toThrow();
    expect(() => s.checkout(c({ macchiato: 0, hotsand: 0 }), 0)).toThrow();
    expect(s.orders()).toHaveLength(0);
    expect(s.nextNumber()).toBe(1);
  });

  it('再読み込みしても履歴と番号が残る', () => {
    createStore(kv, now).checkout(c({ macchiato: 1, hotsand: 0 }), 300);
    const s2 = createStore(kv, now);
    expect(s2.orders()).toHaveLength(1);
    expect(s2.nextNumber()).toBe(2);
  });

  it('取消しても番号は欠番として残り、集計から除かれる', () => {
    const s = createStore(kv, now);
    s.checkout(c({ macchiato: 1, hotsand: 0 }), 300);
    s.checkout(c({ macchiato: 0, hotsand: 1 }), 300);
    s.void(1);
    expect(s.orders()).toHaveLength(2);
    expect(s.orders()[0].voided).toBe(true);
    expect(s.summary()).toMatchObject({ count: 1, sales: 300, macchiato: 0, hotsand: 1 });
    expect(s.nextNumber()).toBe(3);
  });

  it('存在しない番号の取消はエラー', () => {
    expect(() => createStore(kv, now).void(99)).toThrow();
  });

  it('集計は有効な注文のみを合算する', () => {
    const s = createStore(kv, now);
    s.checkout(c({ macchiato: 1, hotsand: 1 }), 500);
    s.checkout(c({ macchiato: 0, hotsand: 2 }), 500);
    expect(s.summary()).toEqual({ count: 2, sales: 1000, discount: 200, macchiato: 1, hotsand: 3, icecoffee: 0, hotcoffee: 0 });
  });

  it('壊れた保存データでも落ちずに空で始まる', () => {
    kv.setItem('pos.orders.v1', '{broken');
    const s = createStore(kv, now);
    expect(s.orders()).toEqual([]);
    expect(s.nextNumber()).toBe(1);
  });

  it('番号の起点を設定できる(紙の続きから始める)', () => {
    const s = createStore(kv, now);
    s.setNextNumber(31);
    expect(s.checkout(c({ macchiato: 1, hotsand: 0 }), 300).no).toBe(31);
    expect(s.nextNumber()).toBe(32);
  });

  it('CSVにヘッダと取消フラグが出る', () => {
    const s = createStore(kv, now);
    s.checkout(c({ macchiato: 1, hotsand: 0 }), 500);
    s.void(1);
    const lines = s.toCsv().split('\n');
    expect(lines[0]).toBe('no,time,macchiato,hotsand,icecoffee,hotcoffee,total,discount,received,change,voided');
    expect(lines[1]).toBe('1,2026-10-10 10:00:00,1,0,0,0,300,0,500,200,1');
  });

  it('コーヒーを含む会計と集計', () => {
    const s = createStore(kv, now);
    const o = s.checkout(c({ macchiato: 1, icecoffee: 2, hotcoffee: 1 }), 1000);
    expect(o.total).toBe(300 + 600);
    expect(o.change).toBe(100);
    expect(s.summary()).toMatchObject({ icecoffee: 2, hotcoffee: 1, sales: 900 });
  });

  it('コーヒー追加前に保存された注文も0個として読み込める', () => {
    kv.setItem(
      'pos.orders.v1',
      JSON.stringify([{ no: 1, at: new Date(2026, 9, 10).toISOString(), macchiato: 1, hotsand: 0, total: 300, discount: 0, received: 300, change: 0, voided: false }]),
    );
    const s = createStore(kv, now);
    expect(s.orders()[0]).toMatchObject({ icecoffee: 0, hotcoffee: 0 });
    expect(s.summary()).toMatchObject({ count: 1, sales: 300, icecoffee: 0 });
  });
});
