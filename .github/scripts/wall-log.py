#!/usr/bin/env python3
"""See and undo edits to the homepage's shared wall, using the edit log.

    wall-log.py list --since "2026-11-06 04:00"     bursts of edits, in UTC
    wall-log.py list --since "..." --each           every edit, with its id
    wall-log.py undo --from "..." --to "..."        shows what undoing that range would change
    wall-log.py undo --id ID --id ID                the same for particular edits
    wall-log.py check                               compares a replay of the log to the wall

Add --apply to an undo to write it. Undos go in the log too, so they can be undone. A cell that
was edited again after the undone edit is left alone and reported.

Reading the log needs the database secret in ~/.config/jamiesimon/firebase-secret. Writes go
through the same public rules as the page.
"""
import argparse
import collections
import datetime
import json
import os
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

DB_URL = os.environ.get("DB_URL", "https://site-backend-28978-default-rtdb.firebaseio.com")
SECRET_FILE = os.path.expanduser(
    os.environ.get("SECRET_FILE", "~/.config/jamiesimon/firebase-secret")
)
BASE_COMMIT = os.environ.get("BASE_COMMIT", "a147108")  # the last snapshot before the log began
# Erased from the wall by hand between that snapshot and the log's first entry.
UNLOGGED_ERASES = [f"{c}_20" for c in range(-14, 15)]
# Pages from before the log wrote a few more cells in that gap. This later snapshot has them.
UNLOGGED_WRITES_COMMIT = "e99de66"
UNLOGGED_WRITES_BEFORE = 1793929540000  # 2026-11-06 01:45:40 UTC, just after that snapshot
BATCH = 500
BURST_GAP_MS = 20_000
UTC = datetime.timezone.utc


def request(method, path, data=None, secret=False):
    url = f"{DB_URL}/{path}"
    if secret:
        with open(SECRET_FILE) as f:
            url += "?auth=" + urllib.parse.quote(f.read().strip())
    body = None if data is None else json.dumps(data).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(url, body, method=method), timeout=120) as r:
            return json.load(r)
    except urllib.error.HTTPError as error:
        # The URL can hold the secret, so it never goes in the message.
        raise SystemExit(f"{method} {path} failed with HTTP {error.code}") from None


def read_log():
    log = request("GET", "log.json", secret=True) or {}
    return sorted(log.items(), key=lambda item: (item[1]["t"], item[0]))


def read_snapshot(commit):
    shown = subprocess.run(
        ["git", "show", f"{commit}:grid.json"], check=True, capture_output=True, text=True
    )
    return json.loads(shown.stdout) or {}


def read_base(entries):
    subprocess.run(["git", "fetch", "-q", "origin", "grid-backups"], check=True)
    base = read_snapshot(BASE_COMMIT)
    for cell in UNLOGGED_ERASES:
        base.pop(cell, None)
    logged = {entry["c"] for _, entry in entries if entry["t"] < UNLOGGED_WRITES_BEFORE}
    for cell, value in read_snapshot(UNLOGGED_WRITES_COMMIT).items():
        if cell not in base and cell not in logged:
            base[cell] = value
    return base


def parse_time(text):
    parsed = datetime.datetime.fromisoformat(text).replace(tzinfo=UTC)
    return int(parsed.timestamp() * 1000)


def show_time(ms):
    return datetime.datetime.fromtimestamp(ms / 1000, UTC).strftime("%Y-%m-%d %H:%M:%S")


def show_char(value):
    if not value:
        return "⌫"
    return "█" if 0xE000 <= ord(value) <= 0xE00B else value


def replay(base, entries):
    wall = dict(base)
    for _, entry in entries:
        if entry["v"]:
            wall[entry["c"]] = entry["v"]
        else:
            wall.pop(entry["c"], None)
    return wall


def in_range(entries, since, until):
    return [
        item for item in entries
        if (since is None or item[1]["t"] >= since) and (until is None or item[1]["t"] < until)
    ]


def command_list(args):
    since = parse_time(args.since) if args.since else None
    until = parse_time(args.until) + 1000 if args.until else None
    entries = in_range(read_log(), since, until)
    if args.each:
        for key, entry in entries:
            print(f"{show_time(entry['t'])}  {entry['c']:>9}  {show_char(entry['v'])}  {key}")
        return
    bursts = []
    for item in entries:
        if bursts and item[1]["t"] - bursts[-1][-1][1]["t"] <= BURST_GAP_MS:
            bursts[-1].append(item)
        else:
            bursts.append([item])
    for burst in bursts:
        erased = sum(not entry["v"] for _, entry in burst)
        text = "".join(show_char(entry["v"]) for _, entry in burst)[:60]
        print(
            f"{show_time(burst[0][1]['t'])} to {show_time(burst[-1][1]['t'])[11:]}"
            f"  {len(burst) - erased:>4} written {erased:>4} erased  {text}"
        )


def command_undo(args):
    entries = read_log()
    if args.id:
        chosen = set(args.id)
        missing = chosen - {key for key, _ in entries}
        if missing:
            raise SystemExit(f"No such edits: {sorted(missing)}")
    elif args.start and args.end:
        chosen = {key for key, _ in in_range(entries, parse_time(args.start), parse_time(args.end) + 1000)}
    else:
        raise SystemExit("Give --from and --to, or at least one --id")

    by_cell = collections.defaultdict(list)
    for item in entries:
        by_cell[item[1]["c"]].append(item)

    base = read_base(entries)
    live = request("GET", "grid.json") or {}
    changes, kept = {}, []
    for cell, history in by_cell.items():
        picks = [i for i, (key, _) in enumerate(history) if key in chosen]
        if not picks:
            continue
        if any(key not in chosen for key, _ in history[picks[-1] + 1 :]):
            kept.append(cell)
            continue
        earlier = [entry for key, entry in history[: picks[0]]]
        before = earlier[-1]["v"] if earlier else base.get(cell, "")
        if live.get(cell, "") != before:
            changes[cell] = before or None

    erased = sum(value is None for value in changes.values())
    print(f"{len(chosen)} edits selected")
    print(f"to undo them: {len(changes) - erased} cells written, {erased} erased")
    if kept:
        print(f"left alone, edited again afterward: {sorted(kept)}")
    if not args.apply:
        print("Nothing changed. Add --apply to write this to the live wall.")
        return

    run = int(time.time())
    cells = list(changes)
    for start in range(0, len(cells), BATCH):
        edits = {}
        for cell in cells[start : start + BATCH]:
            edits[f"grid/{cell}"] = changes[cell]
            edits[f"log/undo-{run}-{cell}"] = {
                "c": cell,
                "v": changes[cell] or "",
                "t": {".sv": "timestamp"},
            }
        request("PATCH", ".json", edits)
    print("Undone.")


def command_check(_):
    entries = read_log()
    wall = replay(read_base(entries), entries)
    live = request("GET", "grid.json") or {}
    different = sorted(cell for cell in set(wall) | set(live) if wall.get(cell) != live.get(cell))
    print(f"{len(entries)} edits replayed: {len(wall)} cells, the wall has {len(live)}")
    print(f"different cells: {different if different else 'none'}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)

    listing = commands.add_parser("list")
    listing.add_argument("--since")
    listing.add_argument("--until")
    listing.add_argument("--each", action="store_true")
    listing.set_defaults(run=command_list)

    undo = commands.add_parser("undo")
    undo.add_argument("--from", dest="start")
    undo.add_argument("--to", dest="end")
    undo.add_argument("--id", action="append")
    undo.add_argument("--apply", action="store_true")
    undo.set_defaults(run=command_undo)

    check = commands.add_parser("check")
    check.set_defaults(run=command_check)

    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
