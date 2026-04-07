from __future__ import annotations

import asyncio
import dataclasses
import logging
import os

import temporalio.converter
from temporalio.client import Client, TLSConfig
from temporalio.worker import Worker

from banking_workflows.account_transfer_workflow import (
    TASK_QUEUE,
    AccountTransferWorkflow,
)
from banking_workflows.account_transfer_workflow_scenarios import (
    AccountTransferWorkflowScenarios,
)
from banking_workflows.activities import AccountTransferActivities


async def build_client() -> Client:
    address = os.getenv("TEMPORAL_ADDRESS", "127.0.0.1:7233")
    namespace = os.getenv("TEMPORAL_NAMESPACE", "default")
    tls_cert_path = os.getenv("TEMPORAL_CERT_PATH", "")
    tls_key_path = os.getenv("TEMPORAL_KEY_PATH", "")
    api_key = os.getenv("TEMPORAL_API_KEY", "")
    encrypt = os.getenv("BANKING_ENCRYPT", "").lower() in ("1", "true")

    data_converter = temporalio.converter.default()
    if encrypt:
        from banking_workflows.codec import EncryptionCodec

        print("Encrypting payloads")
        data_converter = dataclasses.replace(
            data_converter, payload_codec=EncryptionCodec()
        )

    kwargs: dict = {
        "target_host": address,
        "namespace": namespace,
        "data_converter": data_converter,
    }

    # Prefer API key auth
    if api_key:
        print(f"Using API key auth ({api_key[:4]}...{api_key[-4:]})")
        print(f"  Address:   {address}")
        print(f"  Namespace: {namespace}")
        kwargs["api_key"] = api_key
        kwargs["tls"] = True
    # Fallback to mTLS
    elif tls_cert_path and tls_key_path:
        print("Using mTLS auth")
        print(f"  Address:   {address}")
        print(f"  Namespace: {namespace}")
        print(f"  Cert:      {tls_cert_path}")
        print(f"  Key:       {tls_key_path}")
        with open(tls_cert_path, "rb") as f:
            cert = f.read()
        with open(tls_key_path, "rb") as f:
            key = f.read()
        kwargs["tls"] = TLSConfig(client_cert=cert, client_private_key=key)

    return await Client.connect(**kwargs)


async def run_worker(client: Client | None = None) -> None:
    if client is None:
        client = await build_client()

    task_queue = os.getenv("TEMPORAL_TASK_QUEUE") or TASK_QUEUE
    activities = AccountTransferActivities()

    worker = Worker(
        client,
        task_queue=task_queue,
        workflows=[AccountTransferWorkflow, AccountTransferWorkflowScenarios],
        activities=[
            activities.validate,
            activities.withdraw,
            activities.deposit,
            activities.sendNotification,
            activities.undoWithdraw,
            activities.registerApproval,
            activities.removeApproval,
        ],
    )
    print(f"Worker started, listening on task queue: {task_queue}")
    await worker.run()


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(filename)s:%(lineno)s | %(message)s",
    )
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
