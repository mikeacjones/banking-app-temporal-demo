from __future__ import annotations

import os

import uvicorn


def run() -> None:
    """Entry point for `uv run --package banking-demo-backend server`."""
    reload = os.environ.get("BANKING_RELOAD", "1") == "1"
    uvicorn.run(
        "banking_demo.api.routes:app",
        host="0.0.0.0",
        port=8000,
        reload=reload,
    )


if __name__ == "__main__":
    run()
