/** milk/espresso=マキアート2種, hotsand/hotsandnc=ホットサンドハーフ(通常/キャベツ抜き)。同価格で割引は種類をまたいで共通 */
export type Counts = { milk: number; espresso: number; hotsand: number; hotsandnc: number; icecoffee: number; hotcoffee: number };

export const emptyCounts = (): Counts => ({ milk: 0, espresso: 0, hotsand: 0, hotsandnc: 0, icecoffee: 0, hotcoffee: 0 });

export type ProductId = keyof Counts;

/** 指定商品の個数を delta だけ増減(0未満にはしない) */
export const adjust = (counts: Counts, id: ProductId, delta: number): Counts => ({
  ...counts,
  [id]: Math.max(0, counts[id] + delta),
});

/** 価格表。unit=マキアート/ホットサンドの単品, hs2/mh/mhh=セット価格, coffee=アイス/ホットコーヒー(セット割引の対象外。ホットはラストセール中のみ販売) */
export type PriceTable = { unit: number; hs2: number; mh: number; mhh: number; coffee: number };

export const REGULAR: PriceTable = { unit: 300, hs2: 500, mh: 500, mhh: 700, coffee: 200 };
/** 最終日の売り切り用。単品とコーヒーは据え置き、セットだけ100円単位で下げる */
export const LAST_SALE: PriceTable = { unit: 300, hs2: 400, mh: 400, mhh: 600, coffee: 200 };

/** セット割引。m=マキアート, h=ホットサンドハーフ */
const BUNDLES = [
  { id: 'hs2', label: 'ホットサンド2個', m: 0, h: 2 },
  { id: 'mh', label: 'マキアート+ホットサンド', m: 1, h: 1 },
  { id: 'mhh', label: 'マキアート+ホットサンド2個', m: 1, h: 2 },
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
export function calcPrice({ milk, espresso, hotsand, hotsandnc, icecoffee, hotcoffee }: Counts, table: PriceTable = REGULAR): PriceResult {
  [milk, espresso, hotsand, hotsandnc, icecoffee, hotcoffee].forEach(assertCount);
  const macchiato = milk + espresso;
  hotsand += hotsandnc;
  const { unit, coffee: coffeePrice } = table;
  const coffee = (icecoffee + hotcoffee) * coffeePrice;
  const regular = (macchiato + hotsand) * unit + coffee;

  let best = { total: regular - coffee, use: [0, 0, 0] };
  const maxEach = [Math.floor(hotsand / 2), Math.min(macchiato, hotsand), Math.min(macchiato, Math.floor(hotsand / 2))];

  for (let a = 0; a <= maxEach[0]; a++) {
    for (let b = 0; b <= maxEach[1]; b++) {
      for (let c = 0; c <= maxEach[2]; c++) {
        const m = macchiato - (b + c);
        const h = hotsand - (2 * a + b + 2 * c);
        if (m < 0 || h < 0) continue;
        const total = a * table.hs2 + b * table.mh + c * table.mhh + (m + h) * unit;
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
