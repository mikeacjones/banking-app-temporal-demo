from __future__ import annotations

import asyncio
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from banking_workflows.activities import (
        deposit_activity,
        send_notification_activity,
        undo_withdraw_activity,
        validate_activity,
        withdraw_activity,
    )

TASK_QUEUE = "MoneyTransfer"

DEFAULT_RETRY = RetryPolicy(maximum_attempts=3)


@workflow.defn
class AccountTransferWorkflow:
    """Happy path money transfer workflow.

    Orchestrates: Validate -> Withdraw -> Deposit -> Notify.
    If Deposit fails permanently, compensates by reversing the Withdrawal.
    """

    def __init__(self) -> None:
        self._current_step = "pending"

    @workflow.query
    def get_status(self) -> str:
        return self._current_step

    @workflow.run
    async def run(self, transfer_input: dict) -> dict:
        transfer_id = transfer_input["transfer_id"]
        compensations: list[tuple[str, dict]] = []

        try:
            # Step 1: Validate
            self._current_step = "validate"
            await workflow.execute_activity(
                validate_activity,
                transfer_input,
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=DEFAULT_RETRY,
            )

            # Step 2: Withdraw — register compensation before executing
            self._current_step = "withdraw"
            compensations.append(("undo_withdraw", {**transfer_input}))
            await workflow.execute_activity(
                withdraw_activity,
                transfer_input,
                start_to_close_timeout=timedelta(seconds=15),
                retry_policy=DEFAULT_RETRY,
            )

            # Step 3: Deposit
            self._current_step = "deposit"
            await workflow.execute_activity(
                deposit_activity,
                transfer_input,
                start_to_close_timeout=timedelta(seconds=15),
                retry_policy=DEFAULT_RETRY,
            )

            # Step 4: Notify success
            self._current_step = "notify"
            await workflow.execute_activity(
                send_notification_activity,
                {**transfer_input, "success": True},
                start_to_close_timeout=timedelta(seconds=10),
            )

            self._current_step = "completed"
            return {"success": True, "transfer_id": transfer_id}

        except Exception as e:
            workflow.logger.error(f"Transfer {transfer_id} failed: {e}")
            self._current_step = "compensating"

            async def run_compensations():
                for comp_name, comp_input in reversed(compensations):
                    if comp_name == "undo_withdraw":
                        try:
                            await workflow.execute_activity(
                                undo_withdraw_activity,
                                comp_input,
                                start_to_close_timeout=timedelta(seconds=10),
                                retry_policy=RetryPolicy(maximum_attempts=5),
                            )
                        except Exception as comp_err:
                            workflow.logger.error(
                                f"Compensation failed for {comp_name}: {comp_err}"
                            )

            await asyncio.shield(asyncio.ensure_future(run_compensations()))

            self._current_step = "failed"
            await workflow.execute_activity(
                send_notification_activity,
                {**transfer_input, "success": False},
                start_to_close_timeout=timedelta(seconds=10),
            )

            return {"success": False, "error": str(e), "transfer_id": transfer_id}
