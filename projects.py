"""projects/*.md を読み、作品カードとして表示できる形に変換します。"""

from pathlib import Path

from posts import markdown_to_html

PROJECTS_DIR = Path(__file__).resolve().parent / "projects"


def _read_project(path: Path) -> dict[str, object]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError(f"{path.name}: 先頭に --- で囲んだ設定が必要です")

    _, frontmatter, body = text.split("---\n", 2)
    metadata: dict[str, str] = {}
    for line in frontmatter.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            metadata[key.strip()] = value.strip().strip('"')

    required = {"title", "description"}
    if not required.issubset(metadata):
        raise ValueError(f"{path.name}: title と description が必要です")

    try:
        order = int(metadata.get("order", "999"))
    except ValueError as error:
        raise ValueError(f"{path.name}: order は数字で指定してください") from error

    kind = metadata.get("kind", "other")
    if kind not in {"code", "game", "other"}:
        raise ValueError(f"{path.name}: kind は code・game・other のいずれかです")

    return {
        "id": path.stem,
        "title": metadata["title"],
        "filename": metadata.get("filename", path.name),
        "description": metadata["description"],
        "status": metadata.get("status", "制作中"),
        "kind": kind,
        "url": metadata.get("url", ""),
        "link_text": metadata.get("link_text", "作品を見る"),
        "order": order,
        "body_html": markdown_to_html(body.strip()),
    }


def load_projects() -> list[dict[str, object]]:
    projects = [
        _read_project(path)
        for path in PROJECTS_DIR.glob("*.md")
        if not path.name.startswith("_")
    ]
    return sorted(projects, key=lambda project: (project["order"], project["title"]))
