# 点のホームページ

公開URL: https://zrpointc.github.io/Ten-Homepage/

赤黒の色づかいと、手描きの線・貼り紙・小さなメモを合わせた個人ブログです。
PythonのFlaskで動きます。A案「手書きの作業部屋」に、小さなターミナルやコードエディタの要素を組み合わせています。
PCでは左メニュー、900px以下では上部メニューが常に画面に固定されます。日記一覧・記事本文でも同じメニューを使えます。

`main` ブランチへ保存すると、GitHub ActionsがMarkdown日記をHTMLへ変換し、GitHub Pagesへ公開します。
日記を追加したときも、同じURLへ自動で反映されます。

## Windowsで動かす

このフォルダをVS Codeで開き、ターミナルで順番に実行します。

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe app.py
```

ブラウザで http://127.0.0.1:5000/ を開きます。終了はターミナルで `Ctrl+C` です。
`python` が見つからない場合は `py`、または `uv venv` と `uv pip install -r requirements.txt` を使えます。

## 最初に編集する場所

| ファイル | 変えられるもの |
|---|---|
| `content.py` | 名前、自己紹介、現在の活動、SNSリンク |
| `posts/*.md` | 日記の記事 |
| `projects/*.md` | 作品・制作中のもの |
| `static/style.css` | 色、余白、文字の大きさ、手描き風の装飾 |
| `templates/index.html` | 画面の構造 |
| `static/images/icon.jpeg` | プロフィールのイラスト |

たとえば `content.py` の `SOCIAL_LINKS` にある `url` を自分のプロフィールURLにすると、SNSリンクになります。
X・YouTube・TikTokは `fksts10`、GitHubは `zrPointc` を設定しています。
空欄の項目はリンクにせず「準備中」と表示します。
メモやキャラクターはホームページのデザイン案をもとにした初期内容です。自由に差し替えられます。

文章を変更したらPythonをいったん終了して起動し直し、ブラウザを再読み込みしてください。

## 日記を書く

`posts/_template.md` をコピーし、`2026-09-10-title.md` のような名前に変えます。
先頭の `title`・`date`・`summary`・`tags` と、その下の本文を書き換えてください。
ファイル名のうち `.md` より前の部分が記事のURLになります。

## 作品を追加する

`projects/_template.md` をコピーし、`my-app.md` のような名前に変えます。
先頭の `title`・`description`・`status`・`kind`・`url`・`link_text` と、その下の説明文を書き換えてください。
`order` の数字が小さい作品ほど上に表示されます。`kind` は `code`・`game`・`other` から選べます。
ファイル名が `_` で始まるテンプレートはサイトに表示されません。

## 公開版のしくみ

```powershell
.venv\Scripts\python.exe export.py
```

Python / Flaskが作ったページを `dist/` に書き出します。
今回の公開版はそのHTML・CSS・画像を配信する静的サイトです。公開先でPythonが常時動いている構成ではありません。
自分のPCでは `app.py` でFlaskを動かせます。
入力の保存やログインはありません。制作カードは説明とリンクを最初から表示します。

本文はHTMLテンプレート側で自動的にエスケープされます。
Flaskの開発サーバーは自分のPCで確認する用途です。Flask自体をインターネット公開する場合は、Flask対応の運用環境を用意してください。

## 素材

プロフィールには `static/images/icon.jpeg` を使用します。
見出しの手描き風フォントはGoogle FontsのYomogi、本文はZen Maru Gothicを利用します。
読み込めない場合も端末の日本語フォントで表示できます。


## デザインを調整する

- `templates/base.html`：全ページ共通の土台。メニュー・ヘッダー・フッターを読み込みます。
- `templates/_nav.html`：固定メニュー。5つの短い項目をスマホでもすべて表示します。
- `templates/_posts.html`：トップと日記一覧で共通の日記表示。
- `static/style.css`：色・文字・余白・PC／スマホの配置。上書き用の `layout.css` は統合しました。
- `static/site.js`：挨拶のタイピングと現在地表示。挨拶はタブ内で原則一度だけ再生します。

本文とリンクはJavaScriptなしでも利用できます。端末の「動きを減らす」設定ではタイピングを省略します。作品のMarkdownに `filename` を書くと、カード上部のファイル名表示を変更できます。省略時はMarkdownファイル名を使います。

## 表示の確認

GitHub Actionsは公開前に375px・768px・1366pxのChromiumで、トップ／日記一覧／記事本文、固定メニュー、リンク、アンカー移動、タイピング停止を検証します。動きを減らす設定とJavaScript無効時も確認します。実行結果の `layout-screenshots` から各画面の画像を確認できます。失敗した場合は公開されません。

ローカルで同じ検証をする場合（Node.jsも必要）：

```bash
SITE_BASE_PATH=/Ten-Homepage python export.py
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
node tests/check-layout.cjs
```

PowerShellでは最初の行を `$env:SITE_BASE_PATH='/Ten-Homepage'; python export.py` に置き換えてください。
