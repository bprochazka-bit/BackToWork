#!/usr/bin/env python3
"""Download Google Fonts (Inter Tight + JetBrains Mono, Latin subset only)
and produce static/fonts.css with all WOFF2 files embedded as base64 data URIs.

Run once:  python3 generate_fonts.py
Needs internet only this one time; after that the dashboard runs fully offline.
"""
import urllib.request, re, base64
from pathlib import Path

OUT = Path(__file__).parent / "static" / "fonts.css"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

URL = ("https://fonts.googleapis.com/css2"
       "?family=Inter+Tight:wght@300;400;500;600"
       "&family=JetBrains+Mono:wght@400;500;600"
       "&display=swap")


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()


def main() -> None:
    css = fetch(URL).decode("utf-8")
    blocks = re.split(r"(?=@font-face\s*\{)", css)

    latin_blocks = []
    for block in blocks:
        if "@font-face" not in block:
            continue
        m = re.search(r"unicode-range:\s*([^\n;]+)", block)
        if m and "U+0000" in m.group(1):
            latin_blocks.append(block)
        elif not m:
            latin_blocks.append(block)

    out = []
    total = 0
    for block in latin_blocks:
        url_m = re.search(r"url\((https://[^)]+)\)", block)
        if not url_m:
            out.append(block)
            continue
        font_bytes = fetch(url_m.group(1))
        total += len(font_bytes)
        b64 = base64.b64encode(font_bytes).decode("ascii")
        uri = f"data:font/woff2;base64,{b64}"
        out.append(block.replace(url_m.group(0), f"url({uri})"))
        fam = re.search(r"font-family:\s*'([^']+)'", block)
        wt = re.search(r"font-weight:\s*(\d+)", block)
        print(f"  {fam.group(1) if fam else '?':>16}  "
              f"{wt.group(1) if wt else '?':>4}  {len(font_bytes)//1024:>4} KB")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(out))
    print(f"\nwrote {OUT}  ({OUT.stat().st_size // 1024} KB)  "
          f"from {total // 1024} KB of font data")


if __name__ == "__main__":
    main()
