export type Counts = { macchiato: number; hotsand: number; icecoffee: number };

export const emptyCounts = (): Counts => ({ macchiato: 0, hotsand: 0, icecoffee: 0 });

export type ProductId = keyof Counts;

/** 指定商品の個数を delta だけ増減(0未満にはしない) */
export const adjust = (counts: Counts, id: ProductId, delta: number): Counts => ({
  ...counts,
  [id]: Math.max(0, counts[id] + delta),
});

export const UNIT_PRICE = 300;
export const COFFEE_PRICE = 200; // セット割引の対象外

/** セット割引。m=マキアート, h=ホットサンドハーフ */
const BUNDLES = [
  { id: 'hs2', label: 'ホットサンド2個', m: 0, h: 2, price: 500 },
  { id: 'mh', label: 'マキアート+ホットサンド', m: 1, h: 1, price: 500 },
  { id: 'mhh', label: 'マキアート+ホットサンド2個', m: 1, h: 2, price: 700 },
] as const;

export type PriceResult = {
  regular: number;
  discount: number;
  total: number;
  bundles: { id: string; label: string; count: number }[];
};

function assertCount(n: number) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`invalid count: ${n}`);
}

/** セットの使い方を全探索して最安の合計を返す(数量は祭りの規模なら十分小さい) */
export function calcPrice({ macchiato, hotsand, icecoffee }: Counts): PriceResult {
  [macchiato, hotsand, icecoffee].forEach(assertCount);
  const coffee = icecoffee * COFFEE_PRICE;
  const regular = (macchiato + hotsand) * UNIT_PRICE + coffee;

  let best = { total: regular - coffee, use: [0, 0, 0] };
  const maxEach = [Math.floor(hotsand / 2), Math.min(macchiato, hotsand), Math.min(macchiato, Math.floor(hotsand / 2))];

  for (let a = 0; a <= maxEach[0]; a++) {
    for (let b = 0; b <= maxEach[1]; b++) {
      for (let c = 0; c <= maxEach[2]; c++) {
        const m = macchiato - (b + c);
        const h = hotsand - (2 * a + b + 2 * c);
        if (m < 0 || h < 0) continue;
        const total = a * 500 + b * 500 + c * 700 + (m + h) * UNIT_PRICE;
        if (total < best.total) best = { total, use: [a, b, c] };
      }
    }
  }

  return {
    regular,
    total: best.total + coffee,
    discount: regular - coffee - best.total,
    bundles: BUNDLES.map((bd, i) => ({ id: bd.id, label: bd.label, count: best.use[i] })).filter((x) => x.count > 0),
  };
}
