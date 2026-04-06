from __future__ import annotations

import asyncio
import os

from temporalio.client import Client
from temporalio.worker import Worker

from banking_workflows.account_transfer_workflow import (
    TASK_QUEUE,
    AccountTransferWorkflow,
)
from banking_workflows.account_transfer_workflow_scenarios import (
    AccountTransferWorkflowScenarios,
)
from banking_workflows.activities import (
    deposit_activity,
    register_approval_activity,
    remove_pending_approval_activity,
    send_notification_activity,
    undo_withdraw_activity,
    validate_activity,
    withdraw_activity,
)


async def run_worker(client: Client | None = None) -> None:
    """Start the Temporal worker."""
    if client is None:
        addr = os.environ.get("TEMPORAL_ADDRESS", "localhost:7233")
        client = await Client.connect(addr)

    worker = Worker(
        client,
        task_queue=TASK_QUEUE,
        workflows=[AccountTransferWorkflow, AccountTransferWorkflowScenarios],
        activities=[
            validate_activity,
            withdraw_activity,
            deposit_activity,
            undo_withdraw_activity,
            send_notification_activity,
            register_approval_activity,
            remove_pending_approval_activity,
        ],
    )
    print(f"Worker started, listening on task queue: {TASK_QUEUE}")
    await worker.run()


def main() -> None:
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
