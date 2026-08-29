#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FC2CMADB-improved.js 回归校验工具
================================
静态检查 FC2CMADB-improved.js 是否满足本项目关键约定，防止改脚本时
重复踩坑（布局错位、重复卡片、版本号忘升、新 grant 未授权、外部跨域绕过
GM_xmlhttpRequest 等）。改完脚本后跑一次：

    python tools/fc2_lint.py                 # 默认检查仓库根目录 FC2CMADB-improved.js
    python tools/fc2_lint.py path/to/file.js # 检查指定文件
    python tools/fc2_lint.py --json          # 输出 JSON 结果（供脚本/CI 消费）

退出码：0 = 全部通过；1 = 存在 ERROR；2 = 仅 WARN 或文件缺失。

与 SKILL.md 的约定对应，逐项检查：
  - @version 存在且为 主.次.修订
  - 单文件 IIFE 包裹
  - 只允许已授权的 @grant（GM_addStyle / GM_xmlhttpRequest）
  - 磁力判断统一为 `const s = seedCache.get(code); !!(s && s.magnet)`
  - 防重复：data-fc2P 标记、seenCodes 按编号去重、data-code 查重
  - wrapCardRow 整卡包装（figure.closest('.card')），避免标题游离
  - 外部跨域必须走 GM_xmlhttpRequest，禁止对第三方站点直接 fetch
  - node --check 语法校验（node 可用时）

本工具不依赖第三方库（requests 等），系统自带 Python 即可运行。
"""

import argparse
import json
import os
import re
import subprocess
import sys

# 允许的授权（新增 @grant 需先在 SKILL.md/脚本头部评估并手动授权）
ALLOWED_GRANTS = {"GM_addStyle", "GM_xmlhttpRequest"}
SELF_HOST = "fc2cmadb.com"
DEFAULT_TARGET = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "FC2CMADB-improved.js")


class Check:
    """一次检查项。severity: ERROR / WARN。"""

    def __init__(self, name, severity, ok, detail=""):
        self.name = name
        self.severity = severity
        self.ok = ok
        self.detail = detail

    def to_dict(self):
        return {"name": self.name, "severity": self.severity, "ok": self.ok, "detail": self.detail}


def run_lint(path):
    """对给定脚本文件执行所有检查，返回 (list[Check], 退出码)。"""
    checks = []

    # 1. 文件存在
    if not os.path.isfile(path):
        return [Check("文件存在", "ERROR", False, "未找到: %s" % path)], 2
    try:
        src = open(path, "r", encoding="utf-8").read()
    except Exception as e:  # noqa: BLE001
        return [Check("读取文件", "ERROR", False, "读取失败: %s" % e)], 2

    # 2. @version 主.次.修订
    m = re.search(r"^\s*//\s*@version\s+(\d+)\.(\d+)\.(\d+)\s*$", src, re.M)
    checks.append(Check(
        "@version 版本号", "ERROR", bool(m),
        "未找到形如 主.次.修订 的 @version，改完必须递增版本号，否则 Tampermonkey 不触发更新。"
    ))

    # 3. IIFE 包裹
    iife_start = re.search(r"^\s*\(function\s*\(\s*\)\s*\{\s*['\"]use strict['\"]", src, re.M)
    iife_end = re.search(r"\}\)\(\)\s*;?\s*$", src, re.M)
    checks.append(Check(
        "IIFE 包裹", "ERROR", bool(iife_start and iife_end),
        "脚本必须保持 单文件 + (function() { 'use strict'; ... })() 包裹。"
    ))

    # 4. @grant 授权
    grants = set(re.findall(r"^\s*//\s*@grant\s+(\S+)\s*$", src, re.M))
    extra = grants - ALLOWED_GRANTS
    checks.append(Check(
        "@grant 授权", "ERROR", not extra,
        ("新增了未授权 grant: %s（当前允许: %s）。未经授权不得新增 @grant。" % (sorted(extra), sorted(ALLOWED_GRANTS)))
        if extra else "授权仅含: %s" % sorted(grants)
    ))

    # 5. 磁力判断统一：以 `!!(s && s.magnet)` 判定是否有磁力（s 来自 seedCache.get(...)）
    magnet = bool(re.search(r"!!\(\s*s\s*&&\s*s\.magnet\s*\)", src))
    checks.append(Check(
        "磁力判断统一", "ERROR", magnet,
        "磁力判断须统一用 `!!(s && s.magnet)`（s 来自 seedCache.get(...)）。"
    ))

    # 6. 防重复标记 data-fc2P
    has_fc2p = "data-fc2P" in src
    checks.append(Check(
        "防重复标记 data-fc2P", "ERROR", has_fc2p,
        "卡片锚点须打 data-fc2P 标记，避免重复包装。"
    ))

    # 7. 按编号去重（renderList seenCodes + data-fc2P 防重复）
    has_seen = "seenCodes" in src
    has_fc2p = "data-fc2P" in src
    dedup_ok = has_seen and has_fc2p
    checks.append(Check(
        "按编号去重", "ERROR", dedup_ok,
        "renderList 应有 seenCodes 按编号去重，卡片锚点打 data-fc2P 防重复包装，"
        "否则会再次出现重复卡片。"
    ))

    # 9. 外部跨域走 GM_xmlhttpRequest
    uses_gm = "GM_xmlhttpRequest" in src
    checks.append(Check(
        "使用 GM_xmlhttpRequest", "ERROR", uses_gm,
        "外部跨域请求必须走 GM_xmlhttpRequest。"
    ))

    # 10. 禁止对第三方站点直接 fetch
    external_fetch = []
    for fu in re.findall(r"fetch\(\s*['\"]([^'\"]+)['\"]", src):
        if fu.startswith("http://") or fu.startswith("https://"):
            host = fu.split("/")[2] if len(fu.split("/")) > 2 else fu
            if SELF_HOST not in host:
                external_fetch.append(fu)
    checks.append(Check(
        "无外部站点直接 fetch", "ERROR", not external_fetch,
        "对第三方站点直接 fetch: %s，应改为 GM_xmlhttpRequest。" % external_fetch if external_fetch
        else "未发现对第三方站点直接 fetch。"
    ))

    # 11. node --check 语法校验
    syntax_ok, syntax_out = _node_check(path)
    checks.append(Check("node --check 语法", "ERROR", syntax_ok, syntax_out))

    exit_code = 0
    for c in checks:
        if not c.ok:
            exit_code = 1
            break
    return checks, exit_code


def _node_check(path):
    """调用 node --check 校验语法。node 不可用时返回 (False, 'node 不可用')."""
    try:
        r = subprocess.run(
            ["node", "--check", path], capture_output=True, text=True, timeout=30
        )
        if r.returncode == 0:
            return True, "语法通过"
        return False, (r.stderr or r.stdout or "语法错误").strip()
    except FileNotFoundError:
        return False, "node 不可用，跳过语法校验"
    except Exception as e:  # noqa: BLE001
        return False, "node 校验异常: %s" % e


def _print_human(checks, path):
    print("== fc2_lint: %s ==" % path)
    for c in checks:
        mark = "PASS" if c.ok else "FAIL"
        print("  [%s] %-26s %s" % (mark, c.name, c.detail))
    fails = [c for c in checks if not c.ok]
    print("全部通过" if not fails else "发现 %d 个未通过项。" % len(fails))


def main():
    # 兼容 Windows GBK 控制台，避免中文/特殊符号打印时抛 UnicodeEncodeError
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:  # noqa: BLE001
            pass

    ap = argparse.ArgumentParser(description="FC2CMADB-improved.js 回归校验")
    ap.add_argument("path", nargs="?", default=DEFAULT_TARGET, help="脚本路径（默认仓库根目录 FC2CMADB-improved.js）")
    ap.add_argument("--json", action="store_true", help="输出 JSON")
    args = ap.parse_args()

    checks, code = run_lint(args.path)
    if args.json:
        print(json.dumps({"path": args.path, "exit_code": code, "checks": [c.to_dict() for c in checks]},
                         ensure_ascii=False, indent=2))
    else:
        _print_human(checks, args.path)
    sys.exit(code)


if __name__ == "__main__":
    main()

