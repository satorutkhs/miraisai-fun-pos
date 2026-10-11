import { calcPrice, LAST_SALE, REGULAR, type Counts } from './pricing';

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type Order = {
  no: number;
  at: string; // ISO
  milk: number;
  espresso: number;
  hotsand: number;
  hotsandnc: number;
  icecoffee: number;
  total: number;
  discount: number;
  received: number;
  change: number;
  voided: boolean;
  sale: boolean; // ラストセール価格で会計したか
};

export type Summary = {
  count: number;
  sales: number;
  discount: number;
  milk: number;
  espresso: number;
  hotsand: number;
  hotsandnc: number;
  icecoffee: number;
};

const ORDERS_KEY = 'pos.orders.v1';
const NEXT_KEY = 'pos.next.v1';
const SALE_KEY = 'pos.sale.v1';

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

export function createStore(kv: KV, now: () => Date = () => new Date()) {
  let orders: Order[] = load();
  let next = loadNext();
  let lastSale = kv.getItem(SALE_KEY) === '1';

  function load(): Order[] {
    try {
      const v = JSON.parse(kv.getItem(ORDERS_KEY) ?? '[]');
      if (!Array.isArray(v)) return [];
      // 旧形式の注文を読めるようにする: コーヒー追加前は0個、マキアートが1種類だった頃はミルクとして扱う
      return v.map(({ macchiato, ...o }) => ({ milk: macchiato ?? 0, espresso: 0, hotsandnc: 0, icecoffee: 0, sale: false, ...o }));
    } catch {
      return [];
    }
  }

  function loadNext(): number {
    const saved = Number(kv.getItem(NEXT_KEY));
    const fromOrders = orders.reduce((m, o) => Math.max(m, o.no), 0) + 1;
    return Number.isInteger(saved) && saved >= fromOrders ? saved : fromOrders;
  }

  function persist() {
    kv.setItem(ORDERS_KEY, JSON.stringify(orders));
    kv.setItem(NEXT_KEY, String(next));
  }

  return {
    orders: () => orders.slice(),
    nextNumber: () => next,
    lastSale: () => lastSale,

    setLastSale(on: boolean) {
      lastSale = on;
      kv.setItem(SALE_KEY, on ? '1' : '0');
    },

    setNextNumber(n: number) {
      if (!Number.isInteger(n) || n < 1) throw new Error('invalid number');
      next = n;
      persist();
    },

    checkout(counts: Counts, received: number): Order {
      const { total, discount } = calcPrice(counts, lastSale ? LAST_SALE : REGULAR);
      if (Object.values(counts).every((n) => n === 0)) throw new Error('empty order');
      if (!Number.isInteger(received) || received < total) throw new Error('insufficient payment');
      const order: Order = {
        no: next,
        at: now().toISOString(),
        milk: counts.milk,
        espresso: counts.espresso,
        hotsand: counts.hotsand,
        hotsandnc: counts.hotsandnc,
        icecoffee: counts.icecoffee,
        total,
        discount,
        received,
        change: received - total,
        voided: false,
        sale: lastSale,
      };
      orders = [...orders, order];
      next += 1;
      persist();
      return order;
    },

    void(no: number) {
      const o = orders.find((x) => x.no === no);
      if (!o) throw new Error(`order not found: ${no}`);
      orders = orders.map((x) => (x.no === no ? { ...x, voided: true } : x));
      persist();
    },

    summary(): Summary {
      return orders
        .filter((o) => !o.voided)
        .reduce<Summary>(
          (s, o) => ({
            count: s.count + 1,
            sales: s.sales + o.total,
            discount: s.discount + o.discount,
            milk: s.milk + o.milk,
            espresso: s.espresso + o.espresso,
            hotsand: s.hotsand + o.hotsand,
            hotsandnc: s.hotsandnc + o.hotsandnc,
            icecoffee: s.icecoffee + o.icecoffee,
          }),
          { count: 0, sales: 0, discount: 0, milk: 0, espresso: 0, hotsand: 0, hotsandnc: 0, icecoffee: 0 },
        );
    },

    toCsv(): string {
      const head = 'no,time,milk,espresso,hotsand,hotsandnc,icecoffee,total,discount,received,change,voided,sale';
      const rows = orders.map((o) =>
        [o.no, fmt(new Date(o.at)), o.milk, o.espresso, o.hotsand, o.hotsandnc, o.icecoffee, o.total, o.discount, o.received, o.change, o.voided ? 1 : 0, o.sale ? 1 : 0].join(','),
      );
      return [head, ...rows].join('\n');
    },
  };
}

export type Store = ReturnType<typeof createStore>;
