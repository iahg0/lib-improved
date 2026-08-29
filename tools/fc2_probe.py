#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fc2cmadb 站点请求探查工具
=========================
封装对 fc2cmadb.com（Laravel + Inertia + Livewire SPA）的常用请求方法，
用于验证/排查本站数据结构，避免每次临时写 ps1 / 手工 curl。

为什么用 Python 而不是 PowerShell：
  - 页面 <script data-page="app"> 里的 Inertia JSON 含 language 字典，
    存在 "Delete Account" / "Delete account" 这类仅大小写不同的重复 key，
    PowerShell ConvertFrom-Json 会抛 DuplicateKeysInJsonString 卡死；
    Python json.loads 允许重复 key（后者覆盖），不受影响。
  - PowerShell Invoke-WebRequest 发 X-Inertia-* 自定义请求头不可靠（partial
    请求会退化成返回全量 props），必须 curl.exe 或 requests。

关键站点事实（反向工程结论，改脚本前先看 SKILL.md）：
  - 列表数据 articles 是 Inertia deferred prop，不在初始 HTML，需带
    X-Inertia-Partial-Component / -Data 头单独拉取（缺 X-Inertia-Version 会 409）。
  - 列表 articles.data 项 不含 bookmark_count，必须逐张打详情页。
  - 详情页 data-page JSON 里 bookmark_count 是普通引号 "bookmark_count":N，
    脚本正则 /"bookmark_count"\\s*:\\s*(\\d+)/ 可命中。

用法：
  python tools/fc2_probe.py meta     <url>               # 抓列表页 -> component/version/url
  python tools/fc2_probe.py articles <url> [page]        # Inertia partial 拉某页
  python tools/fc2_probe.py detail   <code> ...          # 抓详情页 -> bookmark_count
  python tools/fc2_probe.py fields   <url> [page]        # 输出某页首条的字段名
  python tools/fc2_probe.py rate     <code> ...          # 限流探测：连续请求输出状态码

默认 URL 为 https://fc2cmadb.com/articles/latest；未显式给 https:// 前缀时自动补齐。
"""

import argparse
import json
import re
import sys
from urllib.parse import urljoin

import requests

BASE = "https://fc2cmadb.com"
DEFAULT_LIST = f"{BASE}/articles/latest"
HEADERS = {"User-Agent": "Mozilla/5.0"}


def _absurl(u: str) -> str:
    """补全为绝对 URL（无 scheme 时基于 BASE）。"""
    if not u:
        return DEFAULT_LIST
    if "://" not in u:
        return urljoin(BASE, u if u.startswith("/") else "/" + u)
    return u


# ---------------------------------------------------------------------------
# 核心请求方法（可直接 import 复用）
# ---------------------------------------------------------------------------
def get_page_meta(url: str) -> dict:
    """抓页面 HTML，解析 Inertia data-page JSON，返回 {component, version, url}。

    url 字段里的 `\\/` 转义会被还原为 `/`。
    """
    r = requests.get(_absurl(url), headers=HEADERS, timeout=20)
    r.raise_for_status()
    m = re.search(r'data-page="app" type="application/json">(.*?)</script>', r.text, re.S)
    if not m:
        raise RuntimeError("未找到 data-page JSON，页面可能不是 Inertia 页或结构已变")
    data = json.loads(m.group(1))  # Python 容忍重复 key，不会像 PS 一样抛错
    return {
        "component": data.get("component"),
        "version": data.get("version"),
        "url": (data.get("url") or "").replace("\\/", "/"),
    }


def fetch_articles(url: str, page: int = 1, want: str = "articles") -> tuple[dict, dict]:
    """带 X-Inertia partial 头拉取指定页的 articles，返回 (meta, 完整 JSON)。

    meta 由 get_page_meta 得到（含 version/component，必须带上，否则 409）。
    """
    meta = get_page_meta(url)
    headers = {
        **HEADERS,
        "Accept": "application/json",
        "X-Inertia": "true",
        "X-Inertia-Version": meta["version"],
        "X-Inertia-Partial-Component": meta["component"],
        "X-Inertia-Partial-Data": want,
    }
    full = urljoin(BASE, meta["url"])
    r = requests.get(full, params={"page": page}, headers=headers, timeout=20)
    r.raise_for_status()
    return meta, r.json()


def fetch_detail(code: str) -> tuple[int | None, str]:
    """抓详情页，提取 bookmark_count，返回 (bookmark_count, 原始HTML)。

    命中 429 或解析失败返回 (None, ...)；bookmark_count 缺失返回 None。
    """
    r = requests.get(f"{BASE}/articles/{code}", headers=HEADERS, timeout=20)
    m = re.search(r'"bookmark_count"\s*:\s*(\d+)', r.text)
    return (int(m.group(1)) if m else None), r.text


# ---------------------------------------------------------------------------
# 命令行子命令
# ---------------------------------------------------------------------------
def cmd_meta(a):
    meta = get_page_meta(a.url)
    print(json.dumps(meta, ensure_ascii=False, indent=2))


def cmd_articles(a):
    meta, data = fetch_articles(a.url, a.page)
    props = data.get("props", {})
    art = props.get("articles") or {}
    items = art.get("data") or []
    print(f"component      : {meta['component']}")
    print(f"version        : {meta['version']}")
    print(f"current_page   : {art.get('current_page')} / {art.get('last_page')}")
    print(f"per_page       : {art.get('per_page')}")
    print(f"total          : {art.get('total')}")
    print(f"本页条数       : {len(items)}")
    if items:
        first = items[0]
        print("首条字段       :", ", ".join(first.keys()))
        print("首条 video_id  :", first.get("video_id"))
        print("首条含 bookmark_count  :", "bookmark_count" in first)
        if a.verbose:
            print("首条完整:")
            print(json.dumps(first, ensure_ascii=False, indent=2))


def cmd_fields(a):
    _, data = fetch_articles(a.url, a.page)
    items = ((data.get("props", {}).get("articles") or {}).get("data") or [])
    if not items:
        print("无数据")
        return
    print("\n".join(items[0].keys()))


def cmd_detail(a):
    for code in a.codes:
        count, _ = fetch_detail(code)
        print(f"{code}: bookmark_count={count}")


def cmd_rate(a):
    for code in a.codes:
        r = requests.get(f"{BASE}/articles/{code}", headers=HEADERS, timeout=20)
        print(f"{code}: HTTP {r.status_code}")


def main(argv=None):
    p = argparse.ArgumentParser(prog="fc2_probe", description="fc2cmadb 站点请求探查工具")
    sub = p.add_subparsers(dest="cmd", required=True)

    pm = sub.add_parser("meta", help="抓页面 Inertia data-page JSON 的 component/version/url")
    pm.add_argument("url", nargs="?", default=DEFAULT_LIST)
    pm.set_defaults(fn=cmd_meta)

    pa = sub.add_parser("articles", help="Inertia partial 拉取某页 articles")
    pa.add_argument("url", nargs="?", default=DEFAULT_LIST)
    pa.add_argument("page", nargs="?", type=int, default=1)
    pa.add_argument("-v", "--verbose", action="store_true", help="打印首条完整 JSON")
    pa.set_defaults(fn=cmd_articles)

    pf = sub.add_parser("fields", help="输出某页第一条的字段名")
    pf.add_argument("url", nargs="?", default=DEFAULT_LIST)
    pf.add_argument("page", nargs="?", type=int, default=1)
    pf.set_defaults(fn=cmd_fields)

    pd = sub.add_parser("detail", help="抓详情页输出 bookmark_count")
    pd.add_argument("codes", nargs="+", help="FC 编号，可多个")
    pd.set_defaults(fn=cmd_detail)

    pr = sub.add_parser("rate", help="限流探测：连续请求输出状态码")
    pr.add_argument("codes", nargs="+")
    pr.set_defaults(fn=cmd_rate)

    a = p.parse_args(argv)
    try:
        a.fn(a)
    except requests.HTTPError as e:
        print(f"HTTP 错误: {e}", file=sys.stderr)
        return 1
    except Exception as e:  # noqa: BLE001
        print(f"错误: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
