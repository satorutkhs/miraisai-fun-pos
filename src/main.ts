import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { adjust, calcPrice, emptyCounts, LAST_SALE, REGULAR, type Counts, type ProductId } from './pricing';
import { keypad, quickAmounts, type Key } from './cash';
import { createStore, type KV, type Order } from './store';

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;

function safeStorage(): KV {
  const mem = new Map<string, string>();
  try {
    localStorage.setItem('pos.probe', '1');
    return localStorage;
  } catch {
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) };
  }
}

const kv = safeStorage();
const store = createStore(kv);
const DRAFT_KEY = 'pos.draft.v1';

type Screen =
  | { kind: 'order' }
  | { kind: 'pay'; received: number }
  | { kind: 'done'; order: Order }
  | { kind: 'history' };

let counts: Counts = loadDraft();
let screen: Screen = { kind: 'order' };

function loadDraft(): Counts {
  try {
    const d = JSON.parse(kv.getItem(DRAFT_KEY) ?? '{}');
    const ok = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;
    const n = (v: unknown) => (ok(v) ? (v as number) : 0);
    // 旧形式の下書き(macchiato のみ)はミルクとして読む
    return { milk: n(d.milk) || n(d.macchiato), espresso: n(d.espresso), hotsand: n(d.hotsand), hotsandnc: n(d.hotsandnc), icecoffee: n(d.icecoffee) };
  } catch {
    return emptyCounts();
  }
}
const table = () => (store.lastSale() ? LAST_SALE : REGULAR);
const saveDraft = () => kv.setItem(DRAFT_KEY, JSON.stringify(counts));

const PRODUCTS = [
  { id: 'milk', name: 'ミルクマキアート', price: 300, img: 'img/milk.jpg' },
  { id: 'espresso', name: 'エスプレッソマキアート', price: 300, img: 'img/espresso.jpg' },
  { id: 'icecoffee', name: 'アイスコーヒー', price: 200, img: 'img/icecoffee.jpg' },
  { id: 'hotsand', name: 'ホットサンドハーフ', price: 300, img: 'img/hotsand.jpg' },
  { id: 'hotsandnc', name: 'ホットサンド キャベツ抜き', price: 300, img: 'img/hotsandnc.jpg' },
] as const;

function itemHtml(p: (typeof PRODUCTS)[number]): string {
  const n = counts[p.id];
  return `
    <div class="item">
      <div class="photo">
        <img src="${p.img}" alt="" />
        <button class="tap" data-act="add" data-id="${p.id}" aria-label="${p.name}を追加"></button>
        <div class="badge" data-zero="${n === 0}">${n}</div>
      </div>
      <div class="meta">
        <div class="name">${p.name}</div>
        <div class="price">${yen(p.price)}</div>
        <button class="minus" data-act="sub" data-id="${p.id}" ${n === 0 ? 'disabled' : ''}>−</button>
      </div>
    </div>`;
}

function sideHtml(): string {
  const price = calcPrice(counts, table());
  const empty = PRODUCTS.every((p) => counts[p.id] === 0);
  const rows = [
    ...PRODUCTS.filter((p) => counts[p.id]).map(
      (p) => `<div class="row"><span>${p.name}</span><span>×${counts[p.id]}</span></div>`,
    ),
    ...price.bundles.map((b) => `<div class="row disc"><span>${b.label} ×${b.count}</span></div>`),
    price.discount ? `<div class="row disc"><span>セット割引</span><span>−${yen(price.discount)}</span></div>` : '',
  ].join('');
  return `
    <aside class="side">
      <h2>ご注文</h2>
      <div class="lines">${empty ? '<div class="empty">商品をタップして追加</div>' : rows}</div>
      <div class="total"><span class="label">合計</span><span class="yen">${yen(price.total)}</span></div>
      <div class="actions">
        <button class="btn" data-act="clear" ${empty ? 'disabled' : ''}>クリア</button>
        <button class="btn primary" data-act="pay" ${empty ? 'disabled' : ''}>会計へ</button>
      </div>
    </aside>`;
}

function payHtml(received: number): string {
  const { total } = calcPrice(counts, table());
  const enough = received >= total;
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '00', 'back']
    .map((k) => `<button data-act="key" data-key="${k}">${k === 'back' ? '⌫' : k}</button>`)
    .join('');
  const quick = quickAmounts(total)
    .map((a) => `<button data-act="set" data-v="${a}">${a === total ? 'ちょうど' : yen(a)}</button>`)
    .join('');
  return `
    <div class="modal"><div class="sheet">
      <div class="pay">
        <div>
          <div class="big"><span>合計</span><b>${yen(total)}</b></div>
          <div class="big"><span>お預かり</span><b>${received ? yen(received) : '—'}</b></div>
          <div class="big"><span>${enough || !received ? 'お釣り' : '不足'}</span>
            <b class="${enough ? 'change' : 'short'}">${received ? yen(Math.abs(received - total)) : '—'}</b></div>
          <div class="quick">${quick}</div>
        </div>
        <div class="pad">${keys}<button class="fn" data-act="key" data-key="clear" style="grid-column:1/-1">C 入力クリア</button></div>
      </div>
      <div class="foot">
        <button class="btn" data-act="back">戻る</button>
        <button class="btn ok" data-act="confirm" ${enough ? '' : 'disabled'}>会計を確定する</button>
      </div>
    </div></div>`;
}

function doneHtml(o: Order): string {
  return `
    <div class="modal"><div class="sheet done">
      <div class="chg">お釣り<b>${yen(o.change)}</b></div>
      <div class="tally">
        ${PRODUCTS.filter((p) => o[p.id]).map((p) => `<span>${p.name}</span><span>${o[p.id]} 個</span>`).join('')}
        <span>合計</span><span>${yen(o.total)}</span>
      </div>
      <div class="slip">伝票の番号が <b>${o.no}</b> か確認 → 個数を「正」で記入</div>
      <button class="btn ok" style="width:100%" data-act="next">次の注文へ</button>
    </div></div>`;
}

function historyHtml(): string {
  const s = store.summary();
  const rows = store
    .orders()
    .slice()
    .reverse()
    .map((o) => {
      const t = new Date(o.at);
      const hm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
      return `<tr class="${o.voided ? 'void' : ''}">
        <td>No.${o.no}</td><td>${hm}</td><td>${o.milk}</td><td>${o.espresso}</td><td>${o.hotsand}</td><td>${o.hotsandnc}</td><td>${o.icecoffee}</td><td>${yen(o.total)}</td>
        <td>${o.voided ? '取消済' : `<button data-act="void" data-no="${o.no}">取消</button>`}</td></tr>`;
    })
    .join('');
  return `
    <div class="modal"><div class="sheet hist">
      <h3>売上・履歴</h3>
      <div class="sum">
        <div>売上<b>${yen(s.sales)}</b></div><div>会計数<b>${s.count}</b></div>
        <div>ミルクマキアート<b>${s.milk}</b></div><div>エスプレッソマキアート<b>${s.espresso}</b></div><div>ホットサンド<b>${s.hotsand}</b></div><div>HSキャベツ抜き<b>${s.hotsandnc}</b></div>
        <div>アイスコーヒー<b>${s.icecoffee}</b></div>
      </div>
      <table><thead><tr><th>番号</th><th>時刻</th><th>ミルク</th><th>エスプ</th><th>HS</th><th>HS抜</th><th>アイス</th><th>金額</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="9">まだ注文はありません</td></tr>'}</tbody></table>
      <div class="tools">
        <button data-act="csv">CSV保存</button>
        <button data-act="setnext">次の番号を変更</button>
        <span class="sp"></span>
        <button data-act="close">閉じる</button>
      </div>
    </div></div>`;
}

function render() {
  const modal =
    screen.kind === 'pay' ? payHtml(screen.received)
    : screen.kind === 'done' ? doneHtml(screen.order)
    : screen.kind === 'history' ? historyHtml()
    : '';
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <div class="app">
      <header class="top">
        <span class="brand">FUN ROBO LAB</span>
        <span class="sp"></span>
        ${store.lastSale() ? '<span class="sale">ラストセール価格</span>' : ''}
        <span class="next">次の伝票 No.${store.nextNumber()}</span>
        <button class="menu${store.lastSale() ? ' on' : ''}" data-act="togglesale">ラストセール ${store.lastSale() ? 'ON' : 'OFF'}</button>
        <button class="menu" data-act="history">売上・履歴</button>
      </header>
      <main class="main"><section class="items">${PRODUCTS.map(itemHtml).join('')}</section>${sideHtml()}</main>
    </div>${modal}`;
}

function downloadCsv() {
  const blob = new Blob(['﻿' + store.toCsv()], { type: 'text/csv' });
  const a = document.createElement('a');
  const d = new Date();
  a.href = URL.createObjectURL(blob);
  a.download = `pos-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el) return;
  const id = el.dataset.id as ProductId | undefined;
  switch (el.dataset.act) {
    case 'add': counts = adjust(counts, id!, 1); saveDraft(); break;
    case 'sub': counts = adjust(counts, id!, -1); saveDraft(); break;
    case 'clear': counts = emptyCounts(); saveDraft(); break;
    case 'pay': screen = { kind: 'pay', received: 0 }; break;
    case 'back': case 'close': screen = { kind: 'order' }; break;
    case 'key': if (screen.kind === 'pay') screen = { kind: 'pay', received: keypad(screen.received, el.dataset.key as Key) }; break;
    case 'set': if (screen.kind === 'pay') screen = { kind: 'pay', received: Number(el.dataset.v) }; break;
    case 'confirm': {
      if (screen.kind !== 'pay') return;
      try {
        const order = store.checkout(counts, screen.received);
        counts = emptyCounts();
        saveDraft();
        screen = { kind: 'done', order };
      } catch (err) {
        alert(`会計できません: ${(err as Error).message}`);
      }
      break;
    }
    case 'next': screen = { kind: 'order' }; break;
    case 'togglesale': {
      const on = !store.lastSale();
      const msg = on
        ? 'ラストセール価格に切り替えます。\nホットサンド2個 ¥400 / マキアート+ホットサンド ¥400 / マキアート+ホットサンド2個 ¥600\n(今の入力中の注文にも適用)'
        : '通常価格に戻します。';
      if (confirm(msg)) store.setLastSale(on);
      break;
    }
    case 'history': screen = { kind: 'history' }; break;
    case 'void': {
      const no = Number(el.dataset.no);
      if (confirm(`No.${no} を取り消しますか?`)) store.void(no);
      break;
    }
    case 'csv': downloadCsv(); return;
    case 'setnext': {
      const v = prompt('次に使う伝票番号', String(store.nextNumber()));
      if (v === null) return;
      try { store.setNextNumber(Number(v)); } catch { alert('1以上の整数を入力してください'); }
      break;
    }
  }
  render();
});

// 画面を点灯したままにする(対応端末のみ)
const keepAwake = async () => {
  try { await (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<unknown> } }).wakeLock?.request('screen'); } catch { /* 無視 */ }
};
void keepAwake();
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void keepAwake());
navigator.storage?.persist?.().catch(() => {});

// 新しい版を取得したら自動で再読み込みする(旧版のまま使い続けない)
registerSW({ immediate: true });

render();
