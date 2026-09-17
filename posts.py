"""posts/*.md を読み、日記として表示できる形に変換します。"""

from __future__ import annotations

import html
import re
from datetime import date
from pathlib import Path

POSTS_DIR = Path(__file__).resolve().parent / "posts"


def _inline(text: str) -> str:
    value = html.escape(text, quote=True)
    value = re.sub(r"`([^`]+)`", r"<code>\1</code>", value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", value)
    value = re.sub(r"~~([^~]+)~~", r"<del>\1</del>", value)
    value = re.sub(
        r"\[([^]]+)]\((https?://[^ )]+)\)",
        r'<a href="\2" target="_blank" rel="noopener noreferrer">\1 ↗</a>',
        value,
    )
    return value


def markdown_to_html(markdown: str) -> str:
    """日記に必要な基本記法を、安全なHTMLへ変換します。"""
    output: list[str] = []
    paragraph: list[str] = []
    in_list = False
    in_code = False
    code_lines: list[str] = []

    def flush_paragraph() -> None:
        if paragraph:
            output.append(f"<p>{'<br>'.join(_inline(line) for line in paragraph)}</p>")
            paragraph.clear()

    def close_list() -> None:
        nonlocal in_list
        if in_list:
            output.append("</ul>")
            in_list = False

    for raw_line in markdown.splitlines():
        line = raw_line.rstrip()
        if line.lstrip().startswith("```"):
            flush_paragraph()
            close_list()
            if in_code:
                output.append(f"<pre><code>{html.escape(chr(10).join(code_lines))}</code></pre>")
                code_lines.clear()
            in_code = not in_code
            continue
        if in_code:
            code_lines.append(raw_line)
            continue
        if not line:
            flush_paragraph()
            close_list()
            continue
        heading = re.match(r"^(#{2,4})\s+(.+)$", line)
        if heading:
            flush_paragraph()
            close_list()
            level = len(heading.group(1))
            output.append(f"<h{level}>{_inline(heading.group(2))}</h{level}>")
            continue
        item = re.match(r"^[-*]\s+(.+)$", line)
        if item:
            flush_paragraph()
            if not in_list:
                output.append("<ul>")
                in_list = True
            task = re.match(r"^\[([ xX])\]\s+(.+)$", item.group(1))
            if task:
                checked = " checked" if task.group(1).lower() == "x" else ""
                output.append(
                    f'<li class="task-item"><input type="checkbox" disabled{checked}>'
                    f"<span>{_inline(task.group(2))}</span></li>"
                )
            else:
                output.append(f"<li>{_inline(item.group(1))}</li>")
            continue
        paragraph.append(line)

    flush_paragraph()
    close_list()
    if in_code:
        output.append(f"<pre><code>{html.escape(chr(10).join(code_lines))}</code></pre>")
    return "\n".join(output)


def _read_post(path: Path) -> dict[str, object]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError(f"{path.name}: 先頭に --- で囲んだ設定が必要です")
    _, frontmatter, body = text.split("---\n", 2)
    metadata: dict[str, str] = {}
    tags: list[str] = []
    reading_tags = False
    for line in frontmatter.splitlines():
        if line.startswith("tags:"):
            reading_tags = True
            continue
        if reading_tags and line.strip().startswith("-"):
            tags.append(line.split("-", 1)[1].strip())
            continue
        reading_tags = False
        if ":" in line:
            key, value = line.split(":", 1)
            metadata[key.strip()] = value.strip().strip('"')
    required = {"title", "date"}
    if not required.issubset(metadata):
        raise ValueError(f"{path.name}: title と date が必要です")
    published = date.fromisoformat(metadata["date"])
    summary = metadata.get("summary") or next(
        (line.strip() for line in body.splitlines() if line.strip() and not line.startswith("#")),
        "",
    )
    return {
        "slug": path.stem,
        "title": metadata["title"],
        "date": published,
        "date_text": published.strftime("%Y.%m.%d"),
        "tags": tags,
        "summary": summary,
        "body_html": markdown_to_html(body.strip()),
    }


def load_posts() -> list[dict[str, object]]:
    posts = [_read_post(path) for path in POSTS_DIR.glob("*.md") if not path.name.startswith("_")]
    return sorted(posts, key=lambda post: (post["date"], post["slug"]), reverse=True)
