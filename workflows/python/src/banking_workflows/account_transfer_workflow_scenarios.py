from __future__ import annotations

import asyncio
from collections.abc import Sequence
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RawValue, RetryPolicy

with workflow.unsafe.imports_passed_through():
    from banking_workflows.activities import (
        deposit_activity,
        register_approval_activity,
        remove_pending_approval_activity,
        send_notification_activity,
        undo_withdraw_activity,
        validate_activity,
        withdraw_activity,
    )

DEFAULT_RETRY = RetryPolicy(maximum_attempts=3)


@workflow.defn(dynamic=True)
class AccountTransferWorkflowScenarios:
    """Dynamic workflow that handles all non-happy-path scenarios.

    Branches on workflow_type to handle:
    - AccountTransferWorkflowAdvancedVisibility
    - AccountTransferWorkflowHumanInLoop
    - AccountTransferWorkflowRecoverableFailure (bug in workflow)
    - AccountTransferWorkflowAPIDowntime
    - AccountTransferWorkflowInvalidAccount
    """

    def __init__(self) -> None:
        self._approval_status: str | None = None  # "approved" | "denied"
        self._current_step = "pending"

    @workflow.signal
    def approve_transfer(self) -> None:
        self._approval_status = "approved"

    @workflow.signal
    def deny_transfer(self) -> None:
        self._approval_status = "denied"

    @workflow.query
    def get_status(self) -> str:
        return self._current_step

    @workflow.run
    async def run(self, args: Sequence[RawValue]) -> dict:
        transfer_input = workflow.payload_converter().from_payload(
            args[0].payload, dict
        )
        transfer_id = transfer_input["transfer_id"]
        wf_type = workflow.info().workflow_type
        compensations: list[tuple[str, dict]] = []

        try:
            # Step 1: Validate
            self._current_step = "validate"
            if wf_type == "AccountTransferWorkflowAdvancedVisibility":
                workflow.upsert_search_attributes({"Step": ["Validate"]})
            await workflow.execute_activity(
                validate_activity,
                transfer_input,
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=RetryPolicy(
                    maximum_attempts=3,
                    non_retryable_error_types=["InvalidAccountError"],
                ),
            )

            # Step 2: Withdraw — register compensation before executing
            self._current_step = "withdraw"
            if wf_type == "AccountTransferWorkflowAdvancedVisibility":
                workflow.upsert_search_attributes({"Step": ["Withdraw"]})
            compensations.append(("undo_withdraw", {**transfer_input}))
            await workflow.execute_activity(
                withdraw_activity,
                transfer_input,
                start_to_close_timeout=timedelta(seconds=15),
                retry_policy=RetryPolicy(
                    initial_interval=timedelta(seconds=2),
                    backoff_coefficient=1.5,
                    maximum_interval=timedelta(seconds=8),
                    maximum_attempts=10,
                ),
            )

            # Human-in-the-Loop: wait for approval signal
            if wf_type == "AccountTransferWorkflowHumanInLoop":
                self._current_step = "approval_wait"
                await workflow.execute_activity(
                    register_approval_activity,
                    transfer_input,
                    start_to_close_timeout=timedelta(seconds=5),
                )
                try:
                    await workflow.wait_condition(
                        lambda: self._approval_status is not None,
                        timeout=timedelta(seconds=30),
                    )
                except asyncio.TimeoutError:
                    self._approval_status = "timed_out"

                if self._approval_status == "timed_out":
                    # Clean up the pending approval from the backend
                    await workflow.execute_activity(
                        remove_pending_approval_activity,
                        transfer_input,
                        start_to_close_timeout=timedelta(seconds=5),
                    )
                    raise Exception("Transfer timed out — no approval received")

                if self._approval_status == "denied":
                    raise Exception("Transfer denied by bank operations")

            # Bug in Workflow: intentional error
            if wf_type == "AccountTransferWorkflowRecoverableFailure":
                raise RuntimeError(
                    "BUG: Unexpected NoneType in fee calculation "
                    "(fix requires worker redeployment with workflow.patched('fee-fix'))"
                )

            # Step 3: Deposit
            self._current_step = "deposit"
            if wf_type == "AccountTransferWorkflowAdvancedVisibility":
                workflow.upsert_search_attributes({"Step": ["Deposit"]})
            await workflow.execute_activity(
                deposit_activity,
                transfer_input,
                start_to_close_timeout=timedelta(seconds=15),
                retry_policy=RetryPolicy(
                    initial_interval=timedelta(seconds=2),
                    backoff_coefficient=1.5,
                    maximum_interval=timedelta(seconds=8),
                    maximum_attempts=10,
                ),
            )

            # Step 4: Notify success
            self._current_step = "notify"
            if wf_type == "AccountTransferWorkflowAdvancedVisibility":
                workflow.upsert_search_attributes({"Step": ["Notification"]})
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
