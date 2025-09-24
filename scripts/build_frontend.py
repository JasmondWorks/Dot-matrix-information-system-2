# Auto-build the React app and pack it into LittleFS `data/`.
# Runs as a PlatformIO extra script (pre: hook).

import os
import shutil
import subprocess
import sys
from pathlib import Path
import gzip

try:
    # Provided by PlatformIO
    from SCons.Script import Import  # type: ignore

    Import("env")
    PROJECT_DIR = Path(env["PROJECT_DIR"])  # noqa: F821
except Exception:
    # Allow running standalone for debugging
    PROJECT_DIR = Path(__file__).resolve().parents[1]


FRONTEND_DIR = PROJECT_DIR / "frontend"
DIST_DIR = FRONTEND_DIR / "dist"
DATA_DIR = PROJECT_DIR / "data"

if os.name == "nt":
    NPM_BIN = shutil.which("npm.cmd") or shutil.which("npm.exe") or shutil.which("npm")
else:
    NPM_BIN = shutil.which("npm")


def run(cmd, cwd=None):
    print("[frontend] $", " ".join(cmd))
    try:
        subprocess.check_call(cmd, cwd=str(cwd) if cwd else None)
    except FileNotFoundError as e:
        print(f"[frontend] Tool not found: {e}. Skipping frontend build.")
        return False
    except subprocess.CalledProcessError as e:
        print(f"[frontend] Command failed with code {e.returncode}")
        return False
    return True


def gzip_copy(src: Path, dst_gz: Path):
    dst_gz.parent.mkdir(parents=True, exist_ok=True)
    with open(src, "rb") as f_in, gzip.open(dst_gz, "wb", compresslevel=9) as f_out:
        shutil.copyfileobj(f_in, f_out)


def copy_dist_to_data():
    if DATA_DIR.exists():
        shutil.rmtree(DATA_DIR)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    for p in DIST_DIR.rglob("*"):
        if p.is_dir():
            continue
        rel = p.relative_to(DIST_DIR)
        # Store as gz to save space; server serves .gz transparently
        target = DATA_DIR / (str(rel) + ".gz")
        print(f"[frontend] pack: {rel} -> data/{rel}.gz")
        gzip_copy(p, target)


def main():
    if not FRONTEND_DIR.exists():
        print("[frontend] No frontend/ directory. Skipping.")
        return

    # Allow skipping with env
    if os.getenv("SKIP_FRONTEND"):
        print("[frontend] SKIP_FRONTEND set; skipping build.")
        return

    if not NPM_BIN:
        print("[frontend] npm not found on PATH; skipping build.")
        return

    # Build with existing node_modules. Users should run npm/yarn/pnpm install once.
    if not run([NPM_BIN, "run", "build"], cwd=FRONTEND_DIR):
        # Don't block firmware build if frontend fails; just warn.
        print("[frontend] Build failed or npm not found; continuing without assets.")
        return

    if not DIST_DIR.exists():
        print("[frontend] dist/ not found after build; skipping pack.")
        return

    copy_dist_to_data()


if __name__ == "__main__":
    main()



