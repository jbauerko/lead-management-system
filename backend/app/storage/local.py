from pathlib import Path
from typing import BinaryIO, Protocol
from uuid import UUID, uuid4


class Storage(Protocol):
    def save(self, source: BinaryIO) -> str: ...
    def open(self, key: str) -> BinaryIO: ...
    def delete(self, key: str) -> None: ...


class LocalStorage:
    def __init__(self, root: Path):
        self.root = root.resolve()

    def _path(self, key: str) -> Path:
        # Only generated UUID keys are valid, never filenames or caller paths.
        return self.root / str(UUID(key))

    def save(self, source: BinaryIO) -> str:
        import shutil
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        key = str(uuid4())
        path = self._path(key)
        try:
            with path.open('xb') as target:
                path.chmod(0o600)
                shutil.copyfileobj(source, target, length=65536)
        except Exception:
            path.unlink(missing_ok=True)
            raise
        return key

    def open(self, key: str) -> BinaryIO:
        return self._path(key).open('rb')

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)
