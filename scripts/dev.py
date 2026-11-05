"""Run both dev servers and clean up their process groups on exit (POSIX/WSL)."""
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    children: list[subprocess.Popen] = []
    interrupted = False

    def stop(signum, frame):
        nonlocal interrupted
        interrupted = True

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    try:
        # Separate groups let us stop npm/Vite and uvicorn's reload workers too,
        # without sending signals to other servers the developer already has open.
        for target in ('backend', 'frontend'):
            children.append(subprocess.Popen(['make', target], cwd=ROOT, start_new_session=True))
        print('API: http://localhost:8000/docs | UI: http://localhost:5173\nCtrl-C stops both servers; Postgres stays running.', flush=True)
        while not interrupted:
            for child in children:
                status = child.poll()
                if status is not None:
                    print('A dev server exited; stopping the other server.', file=sys.stderr)
                    return status if status > 0 else 1
            time.sleep(0.1)
        return 0
    finally:
        for child in children:
            try:
                os.killpg(child.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline and any(child.poll() is None for child in children):
            time.sleep(0.1)
        for child in children:
            # Also stop any grandchildren left after their make process exited.
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            child.wait()


if __name__ == '__main__':
    sys.exit(main())
