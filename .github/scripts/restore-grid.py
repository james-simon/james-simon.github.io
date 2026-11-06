#!/usr/bin/env python3
"""Restore the homepage's shared grid from the grid-backups branch.

    git fetch origin grid-backups
    git log origin/grid-backups                       # pick the commit to go back to
    python3 .github/scripts/restore-grid.py COMMIT    # shows what would change
    python3 .github/scripts/restore-grid.py COMMIT --apply

Cells added since the backup are removed, and the rest are put back as they were. Each change
also goes in the edit log, so the log still replays to what's on the wall.
"""
import argparse
import json
import os
import subprocess
import time
import urllib.request

DB_URL = os.environ.get("DB_URL", "https://site-backend-28978-default-rtdb.firebaseio.com")
BATCH = 500


def request(method, path, data=None):
    body = None if data is None else json.dumps(data).encode()
    with urllib.request.urlopen(urllib.request.Request(f"{DB_URL}/{path}", body, method=method), timeout=60) as r:
        return json.load(r)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument("commit", help="commit on the grid-backups branch")
    parser.add_argument("--apply", action="store_true", help="write the changes to the live grid")
    args = parser.parse_args()

    saved = subprocess.run(
        ["git", "show", f"{args.commit}:grid.json"], check=True, capture_output=True, text=True
    ).stdout
    backup = json.loads(saved) or {}
    live = request("GET", "grid.json") or {}

    changes = {key: None for key in live if key not in backup}
    changes.update({key: value for key, value in backup.items() if live.get(key) != value})
    erased = sum(value is None for value in changes.values())
    print(f"backup: {len(backup)} cells, live: {len(live)} cells")
    print(f"to restore: {len(changes) - erased} cells written, {erased} erased")

    if not args.apply:
        print("Nothing changed. Add --apply to write this to the live grid.")
        return

    # The rules only allow writing individual cells and log entries, which a PATCH does.
    run = int(time.time())
    keys = list(changes)
    for start in range(0, len(keys), BATCH):
        edits = {}
        for key in keys[start : start + BATCH]:
            edits[f"grid/{key}"] = changes[key]
            edits[f"log/restore-{run}-{key}"] = {
                "c": key,
                "v": changes[key] or "",
                "t": {".sv": "timestamp"},
            }
        request("PATCH", ".json", edits)
    print("Restored.")


if __name__ == "__main__":
    main()
