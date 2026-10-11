# 引き継ぎ: 未来祭 FUN ROBO LAB カフェ POS

最終更新: 2026-10-09 / 文化祭は**翌日**。最速・安全優先。

## 状況(結論)
- アプリは完成・`main` にマージ済み。コーヒー追加(PR #3)も反映。
- 最新 Deploy to GitHub Pages(run 37902919538, main a475593)= **success**。
- 公開URL(想定): https://satorutkhs.github.io/miraisai-fun-pos/
- 未確認(サンドボックスから github.io に届かないため): 実機タブレットでの
  ホーム画面追加、機内モードでの通し会計、コーヒー表示。**ユーザーの実機確認待ち**。

## 目的・前提
- 学校祭用オフラインPOS。Android 16 タブレット1台(Chrome)、受付1箇所、Wi‑Fiなし、レシート印刷なし。
- 運用: 事前印刷のA4伝票(左=お客様控え番号 / 右=厨房用 番号+個数を「正」で記入)。
  番号は紙に印字済み。受け渡し管理はアプリでしない。
- 初回のみオンラインで開き「ホーム画面に追加」→ 以降は完全オフライン(PWA)。

## 商品・料金
| 品目 | 価格 |
|---|---|
| ミルクマキアート / エスプレッソマキアート | 各300(割引は共通) |
| ホットサンドハーフ(キャベツ抜きも同価格) | 300 |
| ホットサンドハーフ2個 | 500 |
| マキアート+ホットサンドハーフ | 500 |
| マキアート+ホットサンドハーフ2個 | 700 |
| アイスコーヒー | 200(セット割引の対象外) |

### ラストセール(最終日の売り切り用)
画面右上の「ラストセール OFF/ON」で切替(端末内に保存・オフラインで即時反映)。単品とコーヒーは据え置きで、セットのみ下がる。

| 内容 | 通常 | ラストセール |
|---|---|---|
| ホットサンドハーフ2個 | 500円 | 400円 |
| マキアート+ホットサンドハーフ | 500円 | 400円 |
| マキアート+ホットサンドハーフ2個 | 700円 | 600円 |
| ホットコーヒー(ラストセール中のみ販売) | - | 200円 |

価格表は `src/pricing.ts` の `REGULAR` / `LAST_SALE`。CSVの `sale` 列が1ならラストセール価格での会計。ホットコーヒーはON中だけタイルが出て、OFFに戻すと入力中の分も消える(セット割引の対象外)。

価格は総当たりで最安の組合せを計算(`src/pricing.ts`)。

## 構成
- Vite + TypeScript(strict) + Vitest、素のTS UI(`src/main.ts`)、vite-plugin-pwa。
- ロジック: `src/pricing.ts` `src/store.ts` `src/cash.ts`(各 `.test.ts` あり)。
- 永続化: localStorage `pos.draft.v1` / `pos.orders.v1` / `pos.next.v1`(メモリfallback)。
  **キー名を変えると端末内履歴が読めなくなる**。
- 画面: 注文 / 支払い(テンキー+クイック金額) / 完了(お釣り・個数) / 履歴(集計・取消・CSV・次番号変更)。
- CI: `.github/workflows/ci.yml`(PR/非main push で `npm run check` + build)、
  `deploy.yml`(main push で Pages デプロイ)。

## 作業ルール(`CLAUDE.md` 準拠、ユーザーに強く言われた点)
- `main` へ直接pushしない。`feat/` `fix/` `chore/` ブランチ → PR → ユーザーがマージ。
- ロジックはテスト先行(TDD)。コミット前に `npm run check` と `npm run build`。
- 商品・価格変更は `pricing.ts`+テスト+`README.md` の料金表を揃える。
- ネット依存(外部API/CDN/Webフォント)禁止。
- PRはユーザーが自分でマージする。勝手にマージしない。
- GitHub操作は MCP ツール(`gh` CLI なし)。

## ローカル開発(ユーザーのMac)
```
cd /Users/satoru/Developer
git clone https://github.com/satorutkhs/miraisai-fun-pos.git
cd miraisai-fun-pos && nvm use && npm ci
npm run dev        # 開発
npm run check      # 型+テスト
npm run build && npm run preview
```

## 過去のつまずき(再発防止)
- #1(dev-env)が先にmainへ、#2(coffee)は chore/dev-env 宛てに入り main に届かず → #3 で解消。
  **積み上げPRは作らず、常に main 宛ての単独PRにする。**
- `pkill -f "vite preview"` は自分のシェルも落とす。別コマンドで再起動。
- 初回Pagesは未有効で404 → ユーザーが Settings→Pages→Source=GitHub Actions に変更済み。

## 残タスク
1. ユーザー: タブレットで公開URLを開き、ホーム画面に追加 → 機内モードで通し会計(注文→支払い→完了→履歴→CSV)。
2. コーヒー2品がタブレットに出るか確認(出なければ一度オンラインで開き直してSW更新)。
3. 不具合報告があれば fix/ ブランチで TDD → PR。
4. 当日前に履歴をリセットしたい場合の運用確認(次番号変更は履歴画面)。

## 備考
- セッション内のリポジトリは `satorutkhs/miraisai-fun-pos`(別に `ai-business-contest2026` も接続されているが無関係)。
- このファイルは未コミット。リポジトリに入れるなら `chore/handoff` ブランチ→PRで。
