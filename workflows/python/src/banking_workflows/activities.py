from __future__ import annotations

import asyncio
import os
from datetime import datetime

from temporalio import activity
from temporalio.exceptions import ApplicationError

from banking_demo.models import StepStatus

_BACKEND_URL = os.environ.get("BANKING_BACKEND_URL", "")


async def _emit_event(
    transfer_id: str,
    step: str,
    status: StepStatus,
    *,
    attempt: int = 1,
    max_attempts: int = 1,
    error: str | None = None,
    detail: str = "",
) -> None:
    """Push an event via HTTP to the backend."""
    if _BACKEND_URL:
        import aiohttp

        payload = {
            "transfer_id": transfer_id,
            "step": step,
            "status": status.value,
            "attempt": attempt,
            "max_attempts": max_attempts,
            "error": error,
            "detail": detail,
            "timestamp": datetime.now().isoformat(),
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{_BACKEND_URL}/api/internal/events", json=payload
                ) as resp:
                    resp.raise_for_status()
        except Exception:
            pass  # Best effort
    else:
        from banking_demo.api.events import emit_event

        await emit_event(
            transfer_id,
            step,
            status,
            attempt=attempt,
            max_attempts=max_attempts,
            error=error,
            detail=detail,
        )


async def _should_fail_deposit(transfer_id: str) -> bool:
    """Check with backend if deposit should fail (API Downtime scenario)."""
    if _BACKEND_URL:
        import aiohttp

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{_BACKEND_URL}/api/internal/should-fail-deposit/{transfer_id}"
                ) as resp:
                    data = await resp.json()
                    return data.get("should_fail", False)
        except Exception:
            return False
    else:
        from banking_demo.config import should_fail_deposit

        return should_fail_deposit(transfer_id)


async def _register_pending_approval(transfer_id: str, payload: dict) -> None:
    """Register a pending approval with the backend."""
    if _BACKEND_URL:
        import aiohttp

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{_BACKEND_URL}/api/internal/pending-approvals/{transfer_id}",
                    json=payload,
                ) as resp:
                    resp.raise_for_status()
        except Exception:
            pass
    else:
        from banking_demo import config

        config.pending_approvals[transfer_id] = payload


@activity.defn
async def validate_activity(transfer_input: dict) -> dict:
    """Validate the transfer: accounts exist, valid amount."""
    transfer_id = transfer_input["transfer_id"]
    workflow_type = transfer_input.get("workflow_type", "")
    await _emit_event(transfer_id, "validate", StepStatus.RUNNING)

    await asyncio.sleep(0.3)

    # Invalid Account scenario: non-retryable failure
    if workflow_type == "AccountTransferWorkflowInvalidAccount":
        from banking_demo.config import is_invalid_account

        if is_invalid_account(transfer_input["to_account"]):
            await _emit_event(
                transfer_id,
                "validate",
                StepStatus.FAILED,
                error=f"Account {transfer_input['to_account']} does not exist",
            )
            raise ApplicationError(
                f"Account {transfer_input['to_account']} does not exist",
                type="InvalidAccountError",
                non_retryable=True,
            )

    await _emit_event(
        transfer_id,
        "validate",
        StepStatus.COMPLETED,
        detail=f"Validated: {transfer_input['from_account']} -> {transfer_input['to_account']}",
    )
    return {
        "valid": True,
        "from_account": transfer_input["from_account"],
        "to_account": transfer_input["to_account"],
        "amount": transfer_input["amount"],
    }


@activity.defn
async def withdraw_activity(transfer_input: dict) -> dict:
    """Withdraw funds from source account."""
    transfer_id = transfer_input["transfer_id"]
    workflow_type = transfer_input.get("workflow_type", "")
    info = activity.info()
    await _emit_event(transfer_id, "withdraw", StepStatus.RUNNING)

    await asyncio.sleep(0.5)

    # API Downtime scenario: withdraw fails with retryable error
    if workflow_type == "AccountTransferWorkflowAPIDowntime":
        if await _should_fail_deposit(transfer_id):
            await _emit_event(
                transfer_id,
                "withdraw",
                StepStatus.RETRYING,
                attempt=info.attempt,
                max_attempts=10,
                error="Bank API temporarily unavailable",
            )
            raise RuntimeError("Bank API temporarily unavailable — connection timeout")

    from uuid import uuid4

    reference_id = f"WD-{uuid4().hex[:8]}"
    await _emit_event(
        transfer_id,
        "withdraw",
        StepStatus.COMPLETED,
        detail=f"Withdrawn ${transfer_input['amount']:.2f} (ref: {reference_id})",
    )
    return {
        "reference_id": reference_id,
        "amount": transfer_input["amount"],
        "status": "completed",
    }


@activity.defn
async def deposit_activity(transfer_input: dict) -> dict:
    """Deposit funds to destination account."""
    transfer_id = transfer_input["transfer_id"]
    workflow_type = transfer_input.get("workflow_type", "")
    info = activity.info()
    await _emit_event(
        transfer_id,
        "deposit",
        StepStatus.RUNNING,
        attempt=info.attempt,
        max_attempts=10,
    )

    await asyncio.sleep(0.5)

    # Invalid Account scenario: non-retryable failure on deposit
    if workflow_type == "AccountTransferWorkflowInvalidAccount":
        from banking_demo.config import is_invalid_account

        if is_invalid_account(transfer_input["to_account"]):
            await _emit_event(
                transfer_id,
                "deposit",
                StepStatus.FAILED,
                error=f"Account {transfer_input['to_account']} is invalid",
            )
            raise ApplicationError(
                f"Account {transfer_input['to_account']} is invalid",
                type="InvalidAccountError",
                non_retryable=True,
            )

    # API Downtime scenario: deposit fails with retryable error
    if workflow_type == "AccountTransferWorkflowAPIDowntime":
        if await _should_fail_deposit(transfer_id):
            await _emit_event(
                transfer_id,
                "deposit",
                StepStatus.RETRYING,
                attempt=info.attempt,
                max_attempts=10,
                error="Deposit API temporarily unavailable",
            )
            raise RuntimeError("Deposit API temporarily unavailable — connection timeout")

    from uuid import uuid4

    reference_id = f"DEP-{uuid4().hex[:8]}"
    await _emit_event(
        transfer_id,
        "deposit",
        StepStatus.COMPLETED,
        detail=f"Deposited ${transfer_input['amount']:.2f} (ref: {reference_id})",
    )
    return {
        "reference_id": reference_id,
        "amount": transfer_input["amount"],
        "status": "completed",
    }


@activity.defn
async def undo_withdraw_activity(transfer_input: dict) -> dict:
    """Compensation: reverse a withdrawal."""
    transfer_id = transfer_input["transfer_id"]
    await _emit_event(transfer_id, "undo_withdraw", StepStatus.RUNNING)

    await asyncio.sleep(0.3)

    from uuid import uuid4

    reference_id = f"UNDO-{uuid4().hex[:8]}"
    await _emit_event(
        transfer_id,
        "undo_withdraw",
        StepStatus.COMPLETED,
        detail=f"Withdrawal reversed: ${transfer_input['amount']:.2f} (ref: {reference_id})",
    )
    return {
        "reference_id": reference_id,
        "amount": transfer_input["amount"],
        "status": "reversed",
    }


@activity.defn
async def send_notification_activity(transfer_input: dict) -> dict:
    """Send notification about transfer result."""
    transfer_id = transfer_input["transfer_id"]
    success = transfer_input.get("success", True)

    await asyncio.sleep(0.2)

    if success:
        await _emit_event(
            transfer_id,
            "send_notification_success",
            StepStatus.COMPLETED,
            detail="Customer notified: Your transfer has been completed successfully!",
        )
    else:
        await _emit_event(
            transfer_id,
            "send_notification_failure",
            StepStatus.COMPLETED,
            detail="Customer notified: Your transfer could not be completed. "
            "Funds have been returned to your account.",
        )
    return {"notified": True, "success": success}


@activity.defn
async def register_approval_activity(transfer_input: dict) -> dict:
    """Register this transfer as needing approval (human-in-the-loop)."""
    transfer_id = transfer_input["transfer_id"]
    await _emit_event(
        transfer_id,
        "approval_wait",
        StepStatus.RUNNING,
        detail="Awaiting bank employee approval...",
    )

    await _register_pending_approval(
        transfer_id,
        {
            "transfer_id": transfer_id,
            "from_account": transfer_input["from_account"],
            "to_account": transfer_input["to_account"],
            "amount": transfer_input["amount"],
            "created_at": datetime.now().isoformat(),
        },
    )
    return {"registered": True}


@activity.defn
async def remove_pending_approval_activity(transfer_input: dict) -> dict:
    """Remove a pending approval (after timeout or denial)."""
    transfer_id = transfer_input["transfer_id"]

    if _BACKEND_URL:
        import aiohttp

        try:
            async with aiohttp.ClientSession() as session:
                async with session.delete(
                    f"{_BACKEND_URL}/api/internal/pending-approvals/{transfer_id}",
                ) as resp:
                    resp.raise_for_status()
        except Exception:
            pass
    else:
        from banking_demo import config

        config.pending_approvals.pop(transfer_id, None)

    await _emit_event(
        transfer_id,
        "approval_wait",
        StepStatus.FAILED,
        detail="Approval timed out — transfer denied automatically",
    )
    return {"removed": True}
