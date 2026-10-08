"""How long the backend takes to start, and what it loads to get there.

    python -m backend.tools.measure_startup            # from the repository root
    python -m backend.tools.measure_startup --cold     # evict the packages first
    python -m backend.tools.measure_startup --json     # for recording results

A hosted instance that has scaled to zero starts from nothing, and Cloud Run's
logs put that at about 25 seconds from "starting new instance" to the start-up
probe passing. Most of it is not computing but *reading*: the instance pulls the
image's files in as they are first opened, so the cost of an import grows with
the bytes it touches. Two kinds of number come out of this, and they are good
for different things:

- **Bytes loaded by ``import backend.main``** — native libraries and Python
  modules. Deterministic, the same on every machine, and the closest local
  stand-in for what a cold instance has to read. Compare these across a change.
- **Times** — the import; the server answering ``/api/health``; the warm-up
  the start page asks for next (``/warm``), which starts both worker processes,
  each importing the rethon stack for itself; and the first score and first
  simulation after it. ``--no-warm`` skips the warm-up, so the first score and
  simulation start their workers — what happened before there was one. Times
  depend on the machine and on whether the files are already in memory, so
  compare them on one machine, and repeat a run before believing a difference.

``--cold`` asks the operating system to drop the packages from its file cache
before each step, which is the nearest a laptop gets to a fresh instance. On
Linux this needs no privileges. On macOS there is no per-file way: run
``sudo purge`` immediately before the measurement instead.

Each step runs in a fresh process, since an import only costs anything the
first time. Nothing here is imported by the server, and the directory is kept
out of the image (``.dockerignore``).
"""

from __future__ import annotations

import argparse
import ctypes
import importlib.util
import json
import os
import platform
import signal
import site
import socket
import subprocess
import sys
import sysconfig
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parents[2]

# Top-level packages of the rethon stack. If any of these is loaded by
# ``import backend.main``, the server process is paying for computations it
# hands to its workers.
HEAVY = ("rethon", "theodias", "numba", "llvmlite", "numpy", "pandas", "pysat", "dd")


# ── Footprint of an import ────────────────────────────────────────────────────


def _package_dirs() -> list[str]:
    dirs = set(site.getsitepackages()) | {site.getusersitepackages()}
    dirs.add(sysconfig.get_paths()["purelib"])
    dirs.add(sysconfig.get_paths()["platlib"])
    return sorted(d for d in dirs if os.path.isdir(d))


def _native_libraries() -> Optional[list[str]]:
    """Paths of every shared library mapped into this process, or None."""
    if os.path.exists("/proc/self/maps"):
        paths = set()
        with open("/proc/self/maps") as maps:
            for line in maps:
                parts = line.split(maxsplit=5)
                if len(parts) == 6 and parts[5].startswith("/"):
                    paths.add(parts[5].strip())
        return sorted(paths)
    if platform.system() == "Darwin":
        try:
            dyld = ctypes.CDLL(None)
            dyld._dyld_get_image_name.restype = ctypes.c_char_p
            count = dyld._dyld_image_count()
            return sorted({dyld._dyld_get_image_name(i).decode() for i in range(count)})
        except (OSError, AttributeError):
            return None
    return None


def _module_file(module) -> Optional[str]:
    """The file an import actually read: the cached bytecode when there is one."""
    path = getattr(module, "__file__", None)
    if not path:
        return None
    if path.endswith(".py"):
        try:
            cached = importlib.util.cache_from_source(path)
            if os.path.exists(cached):
                return cached
        except NotImplementedError:
            pass
    return path


def _probe_import(module: str) -> dict:
    """Import ``module`` here and describe what it cost. Run in a fresh process."""
    started = time.perf_counter()
    importlib.import_module(module)
    seconds = time.perf_counter() - started

    packages = _package_dirs()
    inside = lambda p: any(p.startswith(d) for d in packages)  # noqa: E731

    libraries = _native_libraries()
    native = None
    if libraries is not None:
        native_paths = [p for p in libraries if inside(p) and os.path.exists(p)]
        native = {
            "files": len(native_paths),
            "mb": round(sum(os.path.getsize(p) for p in native_paths) / 1e6, 1),
        }

    files = {_module_file(m) for m in list(sys.modules.values())}
    python_paths = [
        p
        for p in files
        if p
        and inside(p)
        and os.path.exists(p)
        and not p.endswith((".so", ".pyd", ".dylib"))
    ]
    return {
        "seconds": round(seconds, 2),
        "native": native,
        "python": {
            "modules": len(python_paths),
            "mb": round(sum(os.path.getsize(p) for p in python_paths) / 1e6, 1),
        },
        "heavy_loaded": [name for name in HEAVY if name in sys.modules],
    }


def _run_probe(module: str) -> dict:
    out = subprocess.run(
        [sys.executable, "-m", "backend.tools.measure_startup", "--probe", module],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(out.stdout.strip().splitlines()[-1])


# ── Evicting the file cache ───────────────────────────────────────────────────


def _evict_packages() -> str:
    """Drop the installed packages from the OS file cache, as far as possible."""
    if not hasattr(os, "posix_fadvise"):
        return "not supported here (on macOS run `sudo purge` first)"
    evicted = 0
    for root in _package_dirs() + [str(REPO_ROOT / "backend")]:
        for dirpath, _, names in os.walk(root):
            for name in names:
                try:
                    fd = os.open(os.path.join(dirpath, name), os.O_RDONLY)
                except OSError:
                    continue
                try:
                    os.posix_fadvise(fd, 0, 0, os.POSIX_FADV_DONTNEED)
                    evicted += 1
                except OSError:
                    pass
                finally:
                    os.close(fd)
    return f"{evicted} files evicted"


# ── A real server ─────────────────────────────────────────────────────────────

# The smallest process the simulation accepts: three judgments, a principle and
# one argument. It is here to start the workers, not to measure rethon itself.
_ELEMENTS = [
    {
        "id": i,
        "type": t,
        "status": "active",
        "confidence": 0.8,
        "text": i,
        "addedRound": 1,
    }
    for i, t in [
        ("J1", "judgment"),
        ("J2", "judgment"),
        ("J3", "judgment"),
        ("P1", "principle"),
    ]
]
_RELATIONS = [
    {
        "from": "J1",
        "to": "P1",
        "type": "entails",
        "explanation": "",
        "addedRound": 1,
        "argumentId": "a1",
    }
]
SCORE = {"elements": _ELEMENTS, "relations": _RELATIONS}
SIMULATE = {**SCORE, "round": "1", "local": True, "neighbourhood_depth": 1}


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _request(url: str, body: Optional[dict] = None, timeout: float = 120) -> float:
    """Seconds until ``url`` answered 2xx. Raises on anything else."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, headers={"content-type": "application/json"}
    )
    started = time.perf_counter()
    with urllib.request.urlopen(req, timeout=timeout) as res:
        res.read()
    return time.perf_counter() - started


def _tree_rss_mb(pid: int) -> Optional[float]:
    """Resident memory of ``pid`` and its descendants, Linux only."""
    if not os.path.exists(f"/proc/{pid}"):
        return None
    total, stack = 0, [pid]
    while stack:
        p = stack.pop()
        try:
            for line in open(f"/proc/{p}/status"):
                if line.startswith("VmRSS:"):
                    total += int(line.split()[1])
            for task in os.listdir(f"/proc/{p}/task"):
                children = open(f"/proc/{p}/task/{task}/children").read().split()
                stack.extend(int(c) for c in children)
        except (OSError, ValueError):
            continue
    return round(total / 1024, 1)


def _measure_server(warm: bool) -> dict:
    port = _free_port()
    base = f"http://127.0.0.1:{port}"
    env = {**os.environ, "PYTHONUNBUFFERED": "1"}
    started = time.perf_counter()
    server = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "backend.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--workers",
            "1",
        ],
        cwd=REPO_ROOT,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    try:
        ready = None
        while time.perf_counter() - started < 180:
            if server.poll() is not None:
                raise RuntimeError("the server exited before answering")
            try:
                _request(f"{base}/api/health", timeout=2)
                ready = time.perf_counter() - started
                break
            except (urllib.error.URLError, ConnectionError, OSError):
                time.sleep(0.05)
        if ready is None:
            raise RuntimeError("no answer from /api/health within 180 s")
        rss_idle = _tree_rss_mb(server.pid)

        # What the start page sends after the health check. Older versions have
        # no such endpoint, and the first score then starts the worker itself.
        warm_s = "skipped"
        if warm:
            try:
                warm_s = round(_request(f"{base}/api/simulate_rethon/warm", {}), 2)
            except urllib.error.HTTPError as err:
                if err.code != 404:
                    raise
                warm_s = "not in this version"

        score = f"{base}/api/simulate_rethon/quick_score"
        simulate = f"{base}/api/simulate_rethon/simulate"
        result = {
            "health_ready_s": round(ready, 2),
            "warm_s": warm_s,
            "first_score_s": round(_request(score, SCORE), 2),
            "second_score_s": round(_request(score, SCORE), 2),
            "first_simulation_s": round(_request(simulate, SIMULATE), 2),
            "second_simulation_s": round(_request(simulate, SIMULATE), 2),
            "rss_idle_mb": rss_idle,
            "rss_warm_mb": _tree_rss_mb(server.pid),
        }
        return result
    finally:
        try:
            os.killpg(server.pid, signal.SIGTERM)
            server.wait(timeout=20)
        except (ProcessLookupError, subprocess.TimeoutExpired):
            os.killpg(server.pid, signal.SIGKILL)


# ── Report ────────────────────────────────────────────────────────────────────


def _print_report(r: dict) -> None:
    imp = r["import"]
    native = imp["native"]
    native_text = (
        f"{native['files']} files, {native['mb']} MB"
        if native
        else "not measurable here"
    )
    heavy = ", ".join(imp["heavy_loaded"]) or "none"
    print(f"Python {r['python']} on {r['platform']}; cold: {r['cold']}")
    print()
    print("import backend.main (in a fresh process)")
    print(f"  time                         {imp['seconds']:>7.2f} s")
    print(f"  native libraries             {native_text}")
    print(
        f"  Python modules               {imp['python']['modules']} modules, {imp['python']['mb']} MB"
    )
    print(f"  rethon stack in the server   {heavy}")
    if "server" in r:
        s = r["server"]
        print()
        print("server (uvicorn backend.main:app)")
        print(f"  start -> /api/health answers {s['health_ready_s']:>7.2f} s")
        warm_s = s["warm_s"]
        warm_text = f"{warm_s:>7.2f} s" if isinstance(warm_s, float) else warm_s
        print(f"  warm-up (/warm, both workers) {warm_text}")
        print(
            f"  first score / second         {s['first_score_s']:>7.2f} s / {s['second_score_s']:.2f} s"
        )
        print(
            f"  first simulation / second    {s['first_simulation_s']:>7.2f} s / {s['second_simulation_s']:.2f} s"
        )
        idle, warm = s["rss_idle_mb"], s["rss_warm_mb"]
        if idle is not None:
            print(f"  memory idle / workers warm   {idle:>7.1f} MB / {warm:.1f} MB")


def main(argv: Optional[list[str]] = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--cold",
        action="store_true",
        help="evict the packages from the file cache before each step",
    )
    parser.add_argument(
        "--import-only", action="store_true", help="skip starting a server"
    )
    parser.add_argument(
        "--no-warm",
        action="store_true",
        help="skip /warm, so the first score and simulation start their workers",
    )
    parser.add_argument("--json", action="store_true", help="print one JSON object")
    parser.add_argument("--probe", help=argparse.SUPPRESS)
    args = parser.parse_args(argv)

    if args.probe:
        print(json.dumps(_probe_import(args.probe)))
        return

    report = {
        "python": platform.python_version(),
        "platform": f"{platform.system()} {platform.machine()}",
        "cold": _evict_packages() if args.cold else "no",
    }
    report["import"] = _run_probe("backend.main")
    if not args.import_only:
        if args.cold:
            _evict_packages()
        report["server"] = _measure_server(warm=not args.no_warm)

    if args.json:
        print(json.dumps(report))
    else:
        _print_report(report)


if __name__ == "__main__":
    main()
