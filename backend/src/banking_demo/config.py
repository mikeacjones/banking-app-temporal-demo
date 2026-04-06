from __future__ import annotations

import asyncio

from banking_demo.models import Account, Settings

# ---------------------------------------------------------------------------
# Global mutable state (in-memory, no database)
# ---------------------------------------------------------------------------

settings = Settings()

# In-memory transfer storage
transfers: dict[str, dict] = {}

# Pending approvals for human-in-the-loop scenario
pending_approvals: dict[str, dict] = {}

# SSE event queues: transfer_id -> asyncio.Queue
event_queues: dict[str, asyncio.Queue] = {}

# Deposit failure tracking for API Downtime scenario
deposit_attempt_counts: dict[str, int] = {}


def should_fail_deposit(transfer_id: str) -> bool:
    """For API Downtime scenario: deposit fails for the first ~5 attempts."""
    count = deposit_attempt_counts.get(transfer_id, 0)
    deposit_attempt_counts[transfer_id] = count + 1
    return count < 5


def is_invalid_account(account_id: str) -> bool:
    """Check if an account ID is the invalid test account."""
    return account_id == "ACC-999"


def reset_state() -> None:
    """Reset all in-memory state for a fresh demo run."""
    transfers.clear()
    pending_approvals.clear()
    deposit_attempt_counts.clear()
    for q in event_queues.values():
        while not q.empty():
            try:
                q.get_nowait()
            except asyncio.QueueEmpty:
                break
    event_queues.clear()


# ---------------------------------------------------------------------------
# Mock account data
# ---------------------------------------------------------------------------

ACCOUNTS: list[Account] = [
    Account(
        id="ACC-001",
        name="Primary Checking",
        owner="Alex Johnson",
        balance=5_000.00,
        account_type="checking",
    ),
    Account(
        id="ACC-002",
        name="Savings",
        owner="Alex Johnson",
        balance=25_000.00,
        account_type="savings",
    ),
    Account(
        id="ACC-003",
        name="Business Checking",
        owner="Taylor Corp",
        balance=50_000.00,
        account_type="checking",
    ),
    Account(
        id="ACC-004",
        name="Investment Account",
        owner="Sam Lee",
        balance=100_000.00,
        account_type="savings",
    ),
    Account(
        id="ACC-999",
        name="Invalid Test Account",
        owner="N/A",
        balance=0.00,
        account_type="checking",
    ),
]
