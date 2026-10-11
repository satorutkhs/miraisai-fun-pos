import { describe, expect, it } from 'vitest';
import { adjust, calcPrice, emptyCounts, LAST_SALE, REGULAR } from './pricing';

const c = (m: number, h: number, ice = 0) => ({ milk: m, espresso: 0, hotsand: h, hotsandnc: 0, icecoffee: ice });
const total = (m: number, h: number, ice = 0) => calcPrice(c(m, h, ice)).total;

describe('calcPrice', () => {
  it('空は0円', () => {
    expect(total(0, 0)).toBe(0);
  });
  it('単品は300円', () => {
    expect(total(1, 0)).toBe(300);
    expect(total(0, 1)).toBe(300);
  });
  it('マキアート複数は割引なし', () => {
    expect(total(3, 0)).toBe(900);
  });
  it('ホットサンド2個で500円', () => {
    expect(total(0, 2)).toBe(500);
  });
  it('マキアート+ホットサンドで500円', () => {
    expect(total(1, 1)).toBe(500);
  });
  it('マキアート+ホットサンド2個で700円', () => {
    expect(total(1, 2)).toBe(700);
  });
  it('組み合わせは最安になる', () => {
    expect(total(0, 3)).toBe(800); // 2個500+単品300
    expect(total(0, 4)).toBe(1000);
    expect(total(2, 1)).toBe(800); // セット500+単品300
    expect(total(2, 2)).toBe(1000);
    expect(total(1, 3)).toBe(1000);
    expect(total(2, 4)).toBe(1400);
  });
  it('割引額と定価を返す', () => {
    const r = calcPrice(c(1, 2));
    expect(r.regular).toBe(900);
    expect(r.discount).toBe(200);
    expect(r.total).toBe(700);
  });
  it('どの組み合わせでも定価以下で、割引は非負', () => {
    for (let m = 0; m <= 10; m++) {
      for (let h = 0; h <= 10; h++) {
        const r = calcPrice(c(m, h));
        expect(r.total).toBeLessThanOrEqual(r.regular);
        expect(r.discount).toBe(r.regular - r.total);
      }
    }
  });
  it('負数や小数は拒否', () => {
    expect(() => calcPrice(c(-1, 0))).toThrow();
    expect(() => calcPrice(c(1.5, 0))).toThrow();
  });

  it('アイスコーヒーは200円', () => {
    expect(total(0, 0, 1)).toBe(200);
    expect(total(0, 0, 5)).toBe(1000);
  });
  it('コーヒーはセット割引の対象外で、他商品の割引に影響しない', () => {
    expect(total(1, 2, 1)).toBe(700 + 200);
    expect(total(1, 1, 1)).toBe(500 + 200);
    const r = calcPrice(c(1, 2, 2));
    expect(r.regular).toBe(900 + 400);
    expect(r.discount).toBe(200);
    expect(r.total).toBe(700 + 400);
  });
  it('emptyCounts は全て0', () => {
    expect(emptyCounts()).toEqual(c(0, 0));
  });
  it('adjust は指定商品だけを増減し、0未満にならない', () => {
    expect(adjust(c(1, 1), 'hotsand', 2)).toEqual(c(1, 3));
    expect(adjust(c(1, 3), 'hotsand', -2)).toEqual(c(1, 1));
    expect(adjust(c(0, 1), 'hotsand', -2)).toEqual(c(0, 0));
    expect(adjust(c(2, 0), 'milk', -1)).toEqual(c(1, 0));
  });
  it('ホットサンドを「2個セット」で足すと500円', () => {
    expect(total(0, adjust(emptyCounts(), 'hotsand', 2).hotsand)).toBe(500);
  });
  it('ミルク/エスプレッソ・キャベツ抜きは同じ価格で、セット割引も共通', () => {
    const mix = (milk: number, espresso: number, hotsand: number, hotsandnc: number) =>
      calcPrice({ milk, espresso, hotsand, hotsandnc, icecoffee: 0 }).total;
    expect(mix(0, 1, 0, 0)).toBe(300);
    expect(mix(0, 1, 0, 1)).toBe(500); // エスプレッソ+キャベツ抜き
    expect(mix(1, 0, 1, 0)).toBe(500);
    expect(mix(0, 0, 1, 1)).toBe(500); // 通常+キャベツ抜きでもHS2個
    expect(mix(0, 0, 0, 2)).toBe(500);
    expect(mix(1, 1, 1, 1)).toBe(1000);
    expect(mix(0, 1, 1, 1)).toBe(700);
  });
});

describe('ラストセール価格表', () => {
  const last = (m: number, h: number, ice = 0) => calcPrice(c(m, h, ice), LAST_SALE);
  it('価格表を省略すると通常価格', () => {
    expect(calcPrice(c(1, 2))).toEqual(calcPrice(c(1, 2), REGULAR));
  });
  it('単品は据え置き、セットが下がる', () => {
    expect(last(1, 0).total).toBe(300);
    expect(last(0, 1).total).toBe(300);
    expect(last(0, 2).total).toBe(400);
    expect(last(1, 1).total).toBe(400);
    expect(last(1, 2).total).toBe(600);
  });
  it('2個目以降のセットにも割引が効く', () => {
    expect(last(2, 2).total).toBe(800);
    expect(last(0, 4).total).toBe(800);
    expect(last(0, 3).total).toBe(700);
    expect(last(2, 4).total).toBe(1200);
    expect(last(1, 3).total).toBe(800); // セット400+HS2個400
  });
  it('アイスコーヒーは割引対象外で200円', () => {
    expect(last(1, 1, 2).total).toBe(400 + 400);
  });
  it('全ての金額が100円単位で、通常価格以下', () => {
    for (let m = 0; m <= 8; m++) {
      for (let h = 0; h <= 8; h++) {
        const l = last(m, h).total;
        expect(l % 100).toBe(0);
        expect(l).toBeLessThanOrEqual(calcPrice(c(m, h)).total);
      }
    }
  });
  it('割引額は単品300円換算との差', () => {
    const r = last(1, 2);
    expect(r.regular).toBe(900);
    expect(r.discount).toBe(300);
  });
});
