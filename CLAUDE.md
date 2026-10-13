# 作業ルール

- `main` に直接pushしない。`feat/…` `fix/…` `chore/…` のブランチを切って作業し、PRでマージする。`main` へのマージで GitHub Pages に自動デプロイされる。
- ロジック(`src/pricing.ts` `src/store.ts` `src/cash.ts`)は**テストを先に書く**(TDD)。UIは `src/main.ts`。
- コミット前に `npm run check` と `npm run build` を通す。
- 商品・価格を変えるときは `src/pricing.ts`(通常 `REGULAR` / ラストセール `LAST_SALE`)とそのテスト、`README.md` と `HANDOFF.md` の料金表を揃えて更新する。画面の価格表示は価格表から自動生成されるので、`main.ts` に金額を直書きしない。
- UIを変えたら `npm run check` だけでなく、実際に画面を見て確認する(CSSの崩れはテストで検出できない)。
- ネットワークに依存する機能(外部API・CDN・Webフォント)を入れない。会場はオフライン。
- localStorage のキー(`pos.*`)を変えると端末内の履歴が読めなくなる。変えるなら移行処理を書く。
