# いいね機能の初回セットアップ

このリポジトリには、トップページ全体と各日記に「♡ いいね」を付けるUIが入っています。

GitHub Pagesは静的サイトなので、共有いいね数の保存先としてSupabaseを使います。

## 1. Supabaseでプロジェクトを作る

Supabaseで新しいプロジェクトを1つ作成します。

## 2. SQLを実行する

SupabaseのSQL Editorを開き、`supabase/likes.sql` の内容をそのまま実行します。

このSQLは次を作ります。

- `page_likes` テーブル
- いいね数を取得する `get_like_count` 関数
- いいね／取り消しを切り替える `set_like_state` 関数

ブラウザからテーブルを直接読み書きする権限は与えず、この2関数だけを公開します。

## 3. Project URL と Publishable key を設定する

SupabaseのConnect画面から次をコピーします。

- Project URL
- Publishable key (`sb_publishable_...`)

`static/likes-config.js` を開いて設定します。

```js
window.TEN_LIKES_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabasePublishableKey: "sb_publishable_xxxxxxxxx",
};
```

Publishable keyはブラウザで使うための公開用キーです。

**Secret key (`sb_secret_...`) は絶対にここへ入れないでください。**

## 4. mainへ反映する

設定後にmainへマージすると、GitHub Pagesの通常のデプロイで有効になります。

設定値が空のままの場合、いいねUI自体が表示されないため、公開ページが壊れることはありません。

## 仕様

- トップページ全体: `homepage`
- 日記: `diary:<slug>`
- ログイン不要
- 同じブラウザでは同じ対象に1票
- もう一度押すと取り消し
- ブラウザのLocalStorageを消すと別端末相当になります

これは厳密な投票・ランキング用途ではなく、個人サイト向けの軽いリアクション機能です。完全な多重投票防止は行いません。
