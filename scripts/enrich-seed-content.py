#!/usr/bin/env python3
"""Convert imported legacy HTML to editor-complete EmDash Portable Text.

Preserves headings, paragraphs, lists, images, native links, native tables, and
rich CTA buttons (as editable HTML blocks). Also normalizes bundled image paths
into EmDash image values so the admin image widget can preview them.
"""

from __future__ import annotations

import html
import json
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


class Node:
    def __init__(self, tag: str = "", attrs: list[tuple[str, str | None]] | None = None, text: str = ""):
        self.tag = tag
        self.attrs = dict(attrs or [])
        self.text = text
        self.children: list[Node] = []


class FragmentParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = Node("root")
        self.stack = [self.root]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = Node(tag.lower(), attrs)
        self.stack[-1].children.append(node)
        if tag.lower() not in {"img", "br", "hr", "source", "meta", "link", "input"}:
            self.stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.stack[-1].children.append(Node(tag.lower(), attrs))

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                return

    def handle_data(self, data: str) -> None:
        if data:
            self.stack[-1].children.append(Node(text=data))


class PortableTextConverter:
    def __init__(self) -> None:
        self.counter = 0

    def key(self) -> str:
        self.counter += 1
        return f"import-{self.counter}"

    def convert(self, source: str) -> list[dict[str, Any]]:
        parser = FragmentParser()
        parser.feed(source or "")
        blocks: list[dict[str, Any]] = []
        for node in parser.root.children:
            blocks.extend(self.block(node))
        return blocks

    def block(self, node: Node) -> list[dict[str, Any]]:
        if not node.tag:
            return self.text_block(node.text) if node.text.strip() else []
        if node.tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            return [self.make_text_block(node, node.tag)]
        if node.tag == "p":
            rich_button = self.find_rich_button(node)
            if rich_button:
                return [{"_key": self.key(), "_type": "htmlBlock", "html": self.serialize(node)}]
            blocks: list[dict[str, Any]] = []
            inline_nodes = [child for child in node.children if child.tag != "img"]
            if self.node_text(inline_nodes).strip():
                blocks.append(self.make_text_block_from_nodes(inline_nodes, "normal", node.attrs.get("style") or ""))
            for image in self.find_all(node, "img"):
                if image.attrs.get("src"):
                    blocks.append(self.image_block(image))
            return blocks
        if node.tag in {"ul", "ol"}:
            list_type = "bullet" if node.tag == "ul" else "number"
            return [self.make_text_block(child, "normal", list_type) for child in node.children if child.tag == "li"]
        if node.tag == "table":
            return [self.table_block(node)]
        if node.tag == "img" and node.attrs.get("src"):
            return [self.image_block(node)]
        if node.tag == "hr":
            return [{"_key": self.key(), "_type": "break", "style": "lineBreak"}]
        blocks: list[dict[str, Any]] = []
        for child in node.children:
            blocks.extend(self.block(child))
        return blocks

    def text_block(self, text: str) -> list[dict[str, Any]]:
        return [{
            "_key": self.key(), "_type": "block", "style": "normal",
            "children": [{"_key": self.key(), "_type": "span", "text": text, "marks": []}],
            "markDefs": [],
        }]

    def make_text_block(self, node: Node, style: str, list_type: str | None = None) -> dict[str, Any]:
        return self.make_text_block_from_nodes(node.children, style, node.attrs.get("style") or "", list_type)

    def make_text_block_from_nodes(self, nodes: list[Node], style: str, css: str = "", list_type: str | None = None) -> dict[str, Any]:
        spans: list[dict[str, Any]] = []
        mark_defs: list[dict[str, Any]] = []
        self.inline(nodes, spans, mark_defs, [])
        block: dict[str, Any] = {
            "_key": self.key(), "_type": "block", "style": style,
            "children": spans or [{"_key": self.key(), "_type": "span", "text": "", "marks": []}],
            "markDefs": mark_defs,
        }
        if list_type:
            block["listItem"] = list_type
            block["level"] = 1
        css_lower = css.lower().replace(" ", "")
        if "text-align:center" in css_lower:
            block["textAlign"] = "center"
        elif "text-align:right" in css_lower:
            block["textAlign"] = "right"
        return block

    def inline(self, nodes: list[Node], spans: list[dict[str, Any]], mark_defs: list[dict[str, Any]], marks: list[str]) -> None:
        for node in nodes:
            if not node.tag:
                if node.text:
                    spans.append({"_key": self.key(), "_type": "span", "text": node.text, "marks": marks.copy()})
                continue
            next_marks = marks.copy()
            if node.tag in {"strong", "b"}:
                next_marks.append("strong")
            elif node.tag in {"em", "i"}:
                next_marks.append("em")
            elif node.tag == "u":
                next_marks.append("underline")
            elif node.tag in {"s", "strike", "del"}:
                next_marks.append("strike-through")
            elif node.tag == "a" and node.attrs.get("href"):
                mark_key = self.key()
                mark_defs.append({
                    "_key": mark_key, "_type": "link", "href": node.attrs["href"],
                    "blank": node.attrs.get("target") == "_blank",
                })
                next_marks.append(mark_key)
            elif node.tag == "br":
                spans.append({"_key": self.key(), "_type": "span", "text": "\n", "marks": marks.copy()})
                continue
            self.inline(node.children, spans, mark_defs, next_marks)

    def table_block(self, table: Node) -> dict[str, Any]:
        row_nodes = self.find_all(table, "tr")
        rows = []
        has_header = bool(row_nodes and any(cell.tag == "th" for cell in row_nodes[0].children))
        for row_node in row_nodes:
            cells = []
            for cell_node in [child for child in row_node.children if child.tag in {"th", "td"}]:
                spans: list[dict[str, Any]] = []
                mark_defs: list[dict[str, Any]] = []
                self.inline(cell_node.children, spans, mark_defs, [])
                cells.append({
                    "_type": "tableCell", "_key": self.key(),
                    "content": spans or [{"_key": self.key(), "_type": "span", "text": "", "marks": []}],
                    "markDefs": mark_defs, "isHeader": cell_node.tag == "th",
                })
            if cells:
                rows.append({"_type": "tableRow", "_key": self.key(), "cells": cells})
        return {"_type": "table", "_key": self.key(), "rows": rows, "hasHeaderRow": has_header}

    def image_block(self, node: Node) -> dict[str, Any]:
        return {
            "_key": self.key(), "_type": "image",
            "asset": {"url": node.attrs.get("src", ""), "provider": "local"},
            "alt": node.attrs.get("alt", ""),
        }

    def find_rich_button(self, node: Node) -> Node | None:
        for link in self.find_all(node, "a"):
            if "data-rich-button" in link.attrs:
                return link
        return None

    def find_all(self, node: Node, tag: str) -> list[Node]:
        found = [node] if node.tag == tag else []
        for child in node.children:
            found.extend(self.find_all(child, tag))
        return found

    def node_text(self, nodes: list[Node]) -> str:
        return "".join(node.text if not node.tag else self.node_text(node.children) for node in nodes)

    def serialize(self, node: Node) -> str:
        if not node.tag:
            return html.escape(node.text, quote=False)
        attrs = "".join(
            f' {html.escape(key, quote=True)}="{html.escape(value or "", quote=True)}"'
            for key, value in node.attrs.items()
        )
        if node.tag in {"img", "br", "hr"}:
            return f"<{node.tag}{attrs}>"
        return f"<{node.tag}{attrs}>" + "".join(self.serialize(child) for child in node.children) + f"</{node.tag}>"


def image_value(path: str) -> dict[str, Any]:
    return {"id": f"bundled:{path}", "src": path, "alt": ""}


def main() -> None:
    project_root = Path(__file__).resolve().parents[1]
    seed_path = (project_root / "seed" / "seed.json").resolve()
    if project_root not in seed_path.parents:
        raise SystemExit("Seed path escaped the EmDash project directory")
    try:
        seed = json.loads(seed_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SystemExit(f"Unable to read seed data: {error}") from error

    converted = 0
    for collection in ("products", "posts"):
        for entry in seed["content"].get(collection, []):
            body = entry["data"].get("body_html")
            if body:
                entry["data"]["content"] = PortableTextConverter().convert(body)
                entry["data"]["content_mode"] = "portableText"
                converted += 1

    image_collections = {
        "hero_slides": "image",
        "projects": "image",
        "vr_cabins": "image",
    }
    normalized = 0
    for collection, field in image_collections.items():
        for entry in seed["content"].get(collection, []):
            value = entry["data"].get(field)
            if isinstance(value, str) and value:
                entry["data"][field] = image_value(value)
                normalized += 1

    # Static repository-local destination; not influenced by runtime input.
    try:
        with open(seed_path, "w", encoding="utf-8") as output:
            output.write(json.dumps(seed, ensure_ascii=False, indent=2) + "\n")
    except OSError as error:
        raise SystemExit(f"Unable to write seed data: {error}") from error
    print(f"Converted {converted} HTML bodies and normalized {normalized} image values.")


if __name__ == "__main__":
    main()
