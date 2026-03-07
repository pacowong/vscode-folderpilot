#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import sys


def format_time(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def main() -> int:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
    rows: list[tuple[str, str]] = []

    for entry in sorted(target.iterdir(), key=lambda p: p.name.lower()):
        if entry.name in {".agent", "tmp"}:
            continue
        if entry.is_dir():
            continue
        try:
            mtime = format_time(entry.stat().st_mtime)
        except OSError:
            mtime = "unknown"
        rows.append((entry.name, mtime))

    print("| File | Modified Time |")
    print("| --- | --- |")
    for name, mtime in rows:
        print(f"| {name} | {mtime} |")

    if rows:
        print(f"\nMost recently modified file: {rows[0][0]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
