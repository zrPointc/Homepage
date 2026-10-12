# いいね機能のセットアップ

このリポジトリには、トップページ全体と各日記に「♡ いいね」を付けるUIがあります。

GitHub Pagesは静的サイトなので、共有いいね数の保存と匿名ユーザー認証にSupabaseを使います。

## 既に旧いいね機能を使っている場合

### 1. Anonymous Sign-Ins を有効にする

Supabase Dashboard の Auth settings で **Allow anonymous sign-ins** をONにします。

匿名ユーザーはメールアドレスやパスワードを入力しませんが、Supabase側から固有のユーザーIDとアクセストークンが発行されます。

### 2. 移行SQLを一度だけ実行する

Supabaseの **SQL Editor** を開き、

`supabase/migrate_likes_to_anonymous_auth.sql`

の内容をすべてコピーして貼り付け、**Run** を押します。

この移行では、旧方式の `page_likes` を削除せず、

`page_likes_legacy_20261012`

へ固定保存します。

旧方式で付いたいいねは、不正に付けられた20件も含めて「記念の初期いいね数」として残し、今後の表示件数に加算します。

表示件数は次の合計です。

- 旧方式で付いた記念いいね
- Anonymous Auth移行後に付いた新しいいいね

### 3. この変更をmainへ反映する

`fix/likes-anonymous-auth` の変更をmainへマージすると、新方式のフロントエンドが有効になります。

順番は **Anonymous Sign-InsをON → 移行SQLを実行 → コードをmainへマージ** を推奨します。

## 新規セットアップの場合

### 1. Supabaseでプロジェクトを作る

Supabaseで新しいプロジェクトを1つ作成します。

### 2. Anonymous Sign-Ins を有効にする

Auth settings で **Allow anonymous sign-ins** をONにします。

### 3. SQLを実行する

SupabaseのSQL Editorを開き、`supabase/likes.sql` の内容をそのまま実行します。

このSQLは次を作ります。

- `page_likes` テーブル
- いいね数を取得する `get_like_count` 関数
- 自分がいいね済みか確認する `get_like_state` 関数
- いいね／取り消しを切り替える `set_like_state` 関数

テーブル自体をブラウザから直接読み書きする権限は与えません。

## Project URL と Publishable key

`static/likes-config.js` には次を設定します。

```js
window.TEN_LIKES_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabasePublishableKey: "sb_publishable_xxxxxxxxx",
};
```

Publishable keyはブラウザで使うための公開用キーです。

**Secret key (`sb_secret_...`) は絶対にここへ入れないでください。**

## 新方式の仕組み

旧方式では、ブラウザが `client_id` を自由に送信していました。そのためUUIDを偽造すると複数人として扱われました。

新方式では、いいねを押したときにSupabase Anonymous Authで匿名サインインし、DB側の `auth.uid()` を本人IDとして使います。

- ログイン画面なし
- メールアドレス不要
- パスワード不要
- Supabaseが本人IDを発行
- `client_id` をリクエストから指定することはできない
- 同じ匿名ユーザーは同じ対象に1票
- もう一度押すと取り消し
- 別端末やブラウザデータ削除後は別匿名ユーザーになる

## セキュリティ上の限界

これは投票システムではなく、個人サイト向けの軽いリアクションです。

Anonymous Authにすると、任意UUIDを直接送る旧攻撃は防げます。ただし攻撃者が匿名アカウント自体を大量作成する攻撃は別問題です。Supabaseには匿名サインインのIPレート制限がありますが、必要ならCloudflare TurnstileなどのCAPTCHAを追加します。
