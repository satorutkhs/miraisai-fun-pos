import { calcPrice, type Counts } from './pricing';

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type Order = {
  no: number;
  at: string; // ISO
  macchiato: number;
  hotsand: number;
  icecoffee: number;
  total: number;
  discount: number;
  received: number;
  change: number;
  voided: boolean;
};

export type Summary = {
  count: number;
  sales: number;
  discount: number;
  macchiato: number;
  hotsand: number;
  icecoffee: number;
};

const ORDERS_KEY = 'pos.orders.v1';
const NEXT_KEY = 'pos.next.v1';

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

export function createStore(kv: KV, now: () => Date = () => new Date()) {
  let orders: Order[] = load();
  let next = loadNext();

  function load(): Order[] {
    try {
      const v = JSON.parse(kv.getItem(ORDERS_KEY) ?? '[]');
      // コーヒー追加前に保存された注文は0個として読む
      return Array.isArray(v) ? v.map((o) => ({ icecoffee: 0, ...o })) : [];
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

    setNextNumber(n: number) {
      if (!Number.isInteger(n) || n < 1) throw new Error('invalid number');
      next = n;
      persist();
    },

    checkout(counts: Counts, received: number): Order {
      const { total, discount } = calcPrice(counts);
      if (counts.macchiato + counts.hotsand + counts.icecoffee === 0) throw new Error('empty order');
      if (!Number.isInteger(received) || received < total) throw new Error('insufficient payment');
      const order: Order = {
        no: next,
        at: now().toISOString(),
        macchiato: counts.macchiato,
        hotsand: counts.hotsand,
        icecoffee: counts.icecoffee,
        total,
        discount,
        received,
        change: received - total,
        voided: false,
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
            macchiato: s.macchiato + o.macchiato,
            hotsand: s.hotsand + o.hotsand,
            icecoffee: s.icecoffee + o.icecoffee,
          }),
          { count: 0, sales: 0, discount: 0, macchiato: 0, hotsand: 0, icecoffee: 0 },
        );
    },

    toCsv(): string {
      const head = 'no,time,macchiato,hotsand,icecoffee,total,discount,received,change,voided';
      const rows = orders.map((o) =>
        [o.no, fmt(new Date(o.at)), o.macchiato, o.hotsand, o.icecoffee, o.total, o.discount, o.received, o.change, o.voided ? 1 : 0].join(','),
      );
      return [head, ...rows].join('\n');
    },
  };
}

export type Store = ReturnType<typeof createStore>;
