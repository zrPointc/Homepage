"""Python / Flask でホームページを表示する、小さなアプリ。"""

from hashlib import sha256
from pathlib import Path

from flask import Flask, abort, render_template
from content import PROFILE, CURRENT_ACTIVITIES, SOCIAL_LINKS
from posts import load_posts
from projects import load_projects

app = Flask(__name__)


@app.url_defaults
def version_static_assets(endpoint, values):
    """CSS・JS・SVGの内容が変わったらURLも変え、古いキャッシュを残しません。"""
    filename = values.get("filename", "")
    if endpoint != "static" or "v" in values or not filename.endswith((".css", ".js", ".svg")):
        return
    asset = Path(app.static_folder) / filename
    if asset.is_file():
        values["v"] = sha256(asset.read_bytes()).hexdigest()[:12]


@app.get("/")
def home():
    # Pythonの辞書・リストを、画面のテンプレートに渡しています。
    return render_template(
        "index.html",
        profile=PROFILE,
        activities=CURRENT_ACTIVITIES,
        projects=load_projects(),
        social_links=SOCIAL_LINKS,
        latest_posts=load_posts()[:3],
    )


@app.get("/guidelines/")
def guidelines():
    return render_template("guidelines.html", profile=PROFILE, social_links=SOCIAL_LINKS)


@app.get("/diary/")
def diary():
    return render_template("diary.html", profile=PROFILE, posts=load_posts(), social_links=SOCIAL_LINKS)


@app.get("/diary/<slug>/")
def diary_post(slug: str):
    post = next((item for item in load_posts() if item["slug"] == slug), None)
    if post is None:
        abort(404)
    return render_template("post.html", profile=PROFILE, post=post, social_links=SOCIAL_LINKS)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)
