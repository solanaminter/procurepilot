# ProcurePilot — Modal-hosted LLM endpoint (v3).
#
# Serves Qwen2.5-7B-Instruct (Apache 2.0, ungated) behind an OpenAI-compatible
# /v1 API, replacing the HuggingFace router (402 "no credits").
# Served model name: "procurepilot-llm" (stable alias the app sends as model:).
#
# v3 architecture (Oct 14 repair): the `vllm serve` CLI proved unfit here —
# vLLM v0.30 re-initializes the engine multiple times per container (~6 min
# cold start, repeated full weight loads), which outlasts Modal's web_server
# healthcheck patience and caused container churn that burned the entire
# 10-GPU workspace quota on 2026-10-14. v3 bypasses the CLI: a minimal
# FastAPI app drives vLLM's `LLM` class directly (single engine init).
# The HTTP server binds immediately so the healthcheck passes in seconds;
# the model loads in a background thread (~3-4 min: vLLM import + weights
# from the volume); chat requests wait for readiness.
#
# v4 fix (same day): the serve() function must start uvicorn NON-BLOCKING
# and RETURN. Modal's web_server wrapper calls our function, then polls
# the port and builds the request proxy only after we return — a blocking
# uvicorn.run()/subprocess.run() deadlocks this (proxy never created,
# requests hang with zero bytes). This was the true root cause behind the
# v1/v2 "runner initializing too long" crash loop as well.
#
# Contract (unchanged): same endpoint URL, served name, OpenAI /v1 shape,
# hermes-style tool calls, A10G, scale-to-zero (min_containers=0).
#
# Llama-3.1-8B-Instruct was tried first, but the venv's HF token (solanaminter)
# has not accepted Meta's gated-repo license — 403 "not in the authorized
# list" at download.
#
# Deploy:  cd infra/modal-llm && modal deploy serve.py   (from the hack venv)
# Weights volume is populated once via `modal run serve.py::download_model`
# (CPU-only). Endpoint: printed by `modal deploy`.
# Wire the app: LLM_BASE_URL=<endpoint>/v1  LLM_MODEL=procurepilot-llm
#
# Cost: A10G, scale-to-zero — billed only while warm (~$1.10/hr at deploy
# time). Cold start ~= vLLM import + ~20s weight load from the volume.
#
# Secrets: none required at serve time (weights are in the volume).

import json
import re
import threading
import time
import uuid

import modal

MODEL_DIR = "/models/Qwen2.5-7B-Instruct"
# Stable alias the app sends as `model:` — decoupled from the HF repo id.
SERVED_NAME = "procurepilot-llm"
VOLUME_NAME = "procurepilot-models"

# hermes tool-call format emitted by Qwen2.5-Instruct's chat template:
#   <tool_call>\n{"name": "...", "arguments": {...}}\n</tool_call>
_TOOL_CALL_RE = re.compile(r"<tool_call>\s*(\{.*?\})\s*</tool_call>", re.DOTALL)

image = (
    modal.Image.from_registry("nvidia/cuda:12.8.1-devel-ubuntu24.04", add_python="3.12")
    # vllm pinned: unpinned resolves wander across versions on Modal's pip
    # mirror (observed pulling 0.5.x). 0.30.0 is the version verified working
    # in this workspace (Oct 14 repair).
    .pip_install("vllm==0.30.0", "fastapi", "uvicorn[standard]", "huggingface_hub[hf_transfer]")
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

app = modal.App("procurepilot-llm")
vol = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)


@app.function(
    image=modal.Image.debian_slim().pip_install("huggingface_hub[hf_transfer]"),
    volumes={"/models": vol},
    timeout=1800,
)
def download_model() -> str:
    """Populate the weights volume once (CPU-only). Run before first deploy."""
    from huggingface_hub import snapshot_download

    path = snapshot_download("Qwen/Qwen2.5-7B-Instruct", local_dir=MODEL_DIR)
    vol.commit()
    return f"cached: {path}"


# ---------------------------------------------------------------------------
# FastAPI app (module level so the serving function stays small)
# ---------------------------------------------------------------------------

def _parse_hermes_tool_calls(text: str):
    """Extract <tool_call>{"name":..,"arguments":{..}}</tool_call> blocks."""
    calls = []
    for m in _TOOL_CALL_RE.finditer(text or ""):
        try:
            payload = json.loads(m.group(1))
        except json.JSONDecodeError:
            continue
        name = payload.get("name")
        if not name:
            continue
        args = payload.get("arguments", {})
        calls.append(
            {
                "id": f"call_{uuid.uuid4().hex[:12]}",
                "type": "function",
                "function": {
                    "name": name,
                    "arguments": json.dumps(args)
                    if not isinstance(args, str)
                    else args,
                },
            }
        )
    return calls


def create_api():
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse

    api = FastAPI()
    state = {"llm": None, "ready": threading.Event()}

    def _load_llm():
        from vllm import LLM

        state["llm"] = LLM(
            model=MODEL_DIR,
            enforce_eager=True,  # skip torch.compile/CUDA graphs: fast cold start
            max_model_len=8192,
            gpu_memory_utilization=0.90,
        )
        state["ready"].set()

    @api.get("/health")
    async def health():
        return {"status": "ok", "model_ready": state["ready"].is_set()}

    @api.get("/v1/models")
    async def models():
        return {
            "object": "list",
            "data": [
                {
                    "id": SERVED_NAME,
                    "object": "model",
                    "created": int(time.time()),
                    "owned_by": "procurepilot",
                }
            ],
        }

    @api.post("/v1/chat/completions")
    async def chat_completions(req: Request):
        body = await req.json()
        if not state["ready"].wait(timeout=600):
            return JSONResponse(
                {"error": "model still loading"}, status_code=503
            )
        from vllm import SamplingParams

        messages = body.get("messages", [])
        tools = body.get("tools")
        sampling = SamplingParams(
            max_tokens=body.get("max_tokens", 512),
            temperature=body.get("temperature", 0.7),
            top_p=body.get("top_p", 0.8),
        )
        kwargs = {"tools": tools} if tools else {}
        req_out = state["llm"].chat(messages, sampling, **kwargs)[0]
        out = req_out.outputs[0]
        text = out.text or ""

        # Prefer vLLM-parsed tool calls when present; else parse hermes tags.
        tool_calls = []
        parsed = getattr(out, "tool_calls", None)
        if parsed:
            for tc in parsed:
                fn = tc.function
                tool_calls.append(
                    {
                        "id": getattr(tc, "id", f"call_{uuid.uuid4().hex[:12]}"),
                        "type": "function",
                        "function": {
                            "name": fn.name,
                            "arguments": fn.arguments
                            if isinstance(fn.arguments, str)
                            else json.dumps(fn.arguments),
                        },
                    }
                )
        else:
            tool_calls = _parse_hermes_tool_calls(text)
            if tool_calls:
                text = _TOOL_CALL_RE.sub("", text).strip() or None

        return {
            "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": body.get("model", SERVED_NAME),
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": text,
                        "tool_calls": tool_calls or None,
                    },
                    "finish_reason": "tool_calls" if tool_calls else "stop",
                }
            ],
            "usage": {
                "prompt_tokens": len(req_out.prompt_token_ids or []),
                "completion_tokens": len(out.token_ids or []),
                "total_tokens": len(req_out.prompt_token_ids or [])
                + len(out.token_ids or []),
            },
        }

    # Model loads in the background so the HTTP server binds immediately and
    # Modal's healthcheck passes in seconds (no container churn).
    threading.Thread(target=_load_llm, daemon=True).start()
    return api


# v4 (Oct 14 repair, second fix): the function MUST start the server
# non-blocking and RETURN. Modal's web_server wrapper calls our function,
# then polls the port (wait_for_web_server) and builds the request proxy
# *after* we return. A blocking uvicorn.run()/subprocess.run() deadlocks
# this: the proxy is never created and requests hang with zero bytes —
# which is exactly what v1/v2 (blocking `vllm serve`) and v3 (blocking
# uvicorn.run) did. Docs pattern: subprocess.Popen(...) then return.
@app.function(
    image=image,
    gpu="A10G",
    volumes={"/models": vol},
    timeout=3600,
)
@modal.web_server(port=8000, startup_timeout=900)
def serve():
    """Serve the FastAPI app (OpenAI-compatible /v1) via uvicorn.

    Starts uvicorn in a background thread and RETURNS — Modal then
    creates the proxy that forwards web traffic to port 8000.
    The model keeps loading in its own daemon thread; /health answers
    immediately, /v1/chat/completions waits for readiness.
    """
    import threading

    import uvicorn

    api = create_api()
    threading.Thread(
        target=uvicorn.run,
        args=(api,),
        kwargs={"host": "0.0.0.0", "port": 8000, "log_level": "info"},
        daemon=True,
    ).start()
    # Return (do NOT block): Modal polls port 8000 and attaches the proxy.
