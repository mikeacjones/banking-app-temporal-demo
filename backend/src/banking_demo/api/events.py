from __future__ import annotations

import asyncio
import json
from datetime import datetime

from banking_demo import config
from banking_demo.models import StepStatus, TransferEvent


async def emit_event(
    transfer_id: str,
    step: str,
    status: StepStatus,
    *,
    attempt: int = 1,
    max_attempts: int = 1,
    error: str | None = None,
    detail: str = "",
) -> None:
    """Push a transfer event into the SSE queue for the given transfer."""
    queue = config.event_queues.get(transfer_id)
    if queue is None:
        return

    event = TransferEvent(
        transfer_id=transfer_id,
        step=step,
        status=status,
        attempt=attempt,
        max_attempts=max_attempts,
        error=error,
        detail=detail,
        timestamp=datetime.now(),
    )
    await queue.put(event.model_dump(mode="json"))


async def event_generator(transfer_id: str):
    """Async generator yielding SSE events for a given transfer."""
    queue = config.event_queues.get(transfer_id)
    if queue is None:
        return

    while True:
        try:
            event = await asyncio.wait_for(queue.get(), timeout=300)
            yield {"event": "transfer_update", "data": json.dumps(event)}

            status = event.get("status")
            step = event.get("step")

            # Success: notification sent after successful transfer
            if status == "completed" and step == "send_notification_success":
                yield {
                    "event": "transfer_complete",
                    "data": json.dumps({"final_status": "completed"}),
                }
                return

            # Compensation complete: withdrawal reversed
            if status == "completed" and step == "undo_withdraw":
                yield {
                    "event": "transfer_complete",
                    "data": json.dumps({"final_status": "reversed"}),
                }
                return

            # Failure notification sent
            if status == "completed" and step == "send_notification_failure":
                yield {
                    "event": "transfer_complete",
                    "data": json.dumps({"final_status": "failed"}),
                }
                return

            # Non-retryable failure (e.g., invalid account on validate)
            if status == "failed" and step in ("validate", "deposit"):
                yield {
                    "event": "transfer_complete",
                    "data": json.dumps({"final_status": "failed"}),
                }
                return

        except asyncio.TimeoutError:
            yield {"event": "timeout", "data": json.dumps({"timeout": True})}
            return
