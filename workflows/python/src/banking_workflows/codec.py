"""AES-GCM payload encryption codec for Temporal.

When enabled, all workflow/activity payloads are encrypted before being sent
to the Temporal server and decrypted when received by the worker or client.
"""

from __future__ import annotations

import os
from typing import Iterable, List

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from temporalio.api.common.v1 import Payload
from temporalio.converter import PayloadCodec

# Demo-only key. In production, use a proper key management system.
DEFAULT_KEY = b"banking-demo-encryption-key-32b!"
DEFAULT_KEY_ID = "banking-demo-key"


class EncryptionCodec(PayloadCodec):
    def __init__(
        self, key_id: str = DEFAULT_KEY_ID, key: bytes = DEFAULT_KEY
    ) -> None:
        super().__init__()
        self.key_id = key_id
        self.encryptor = AESGCM(key)

    async def encode(self, payloads: Iterable[Payload]) -> List[Payload]:
        return [
            Payload(
                metadata={
                    "encoding": b"binary/encrypted",
                    "encryption-key-id": self.key_id.encode(),
                },
                data=self._encrypt(p.SerializeToString()),
            )
            for p in payloads
        ]

    async def decode(self, payloads: Iterable[Payload]) -> List[Payload]:
        ret: List[Payload] = []
        for p in payloads:
            if p.metadata.get("encoding", b"").decode() != "binary/encrypted":
                ret.append(p)
                continue
            key_id = p.metadata.get("encryption-key-id", b"").decode()
            if key_id != self.key_id:
                raise ValueError(
                    f"Unrecognized key ID {key_id}. Current key ID is {self.key_id}."
                )
            ret.append(Payload.FromString(self._decrypt(p.data)))
        return ret

    def _encrypt(self, data: bytes) -> bytes:
        nonce = os.urandom(12)
        return nonce + self.encryptor.encrypt(nonce, data, None)

    def _decrypt(self, data: bytes) -> bytes:
        return self.encryptor.decrypt(data[:12], data[12:], None)
