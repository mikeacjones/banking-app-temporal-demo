"""Codec server for the Temporal Web UI.

Run this alongside the demo so the Temporal UI at localhost:8233 can decrypt
encrypted payloads on demand. Configure the UI's codec endpoint to:
  http://localhost:8081

Usage:
  uv run --package banking-demo-workflows python -m banking_workflows.codec_server
"""

from __future__ import annotations

from functools import partial
from typing import Awaitable, Callable, Iterable, List

from aiohttp import hdrs, web
from google.protobuf import json_format
from temporalio.api.common.v1 import Payload, Payloads

from banking_workflows.codec import EncryptionCodec


def build_codec_server() -> web.Application:
    async def cors_options(req: web.Request) -> web.Response:
        resp = web.Response()
        origin = req.headers.get(hdrs.ORIGIN, "")
        allowed = (
            "http://localhost:8233",
            "http://localhost:8080",
            "https://cloud.temporal.io",
        )
        if origin in allowed:
            resp.headers[hdrs.ACCESS_CONTROL_ALLOW_ORIGIN] = origin
            resp.headers[hdrs.ACCESS_CONTROL_ALLOW_METHODS] = "POST"
            resp.headers[hdrs.ACCESS_CONTROL_ALLOW_HEADERS] = (
                "content-type,x-namespace"
            )
        return resp

    async def apply(
        fn: Callable[[Iterable[Payload]], Awaitable[List[Payload]]],
        req: web.Request,
    ) -> web.Response:
        assert req.content_type == "application/json"
        payloads = json_format.Parse(await req.read(), Payloads())
        payloads = Payloads(payloads=await fn(payloads.payloads))
        resp = await cors_options(req)
        resp.content_type = "application/json"
        resp.text = json_format.MessageToJson(payloads)
        return resp

    codec = EncryptionCodec()
    app = web.Application()
    app.add_routes(
        [
            web.post("/encode", partial(apply, codec.encode)),
            web.post("/decode", partial(apply, codec.decode)),
            web.options("/encode", cors_options),
            web.options("/decode", cors_options),
        ]
    )
    return app


if __name__ == "__main__":
    import os

    host = os.environ.get("CODEC_SERVER_HOST", "0.0.0.0")
    print("Codec server running on http://localhost:8081")
    print("Set this as the codec endpoint in the Temporal UI")
    web.run_app(build_codec_server(), host=host, port=8081)
