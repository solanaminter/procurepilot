# ProcurePilot — Modal LLM endpoint

OpenAI-compatible inference for ProcurePilot's LLM calls, replacing the
HuggingFace router after it started returning 402 "no remaining credits".

## What it serves

- **Model:** `Qwen/Qwen2.5-7B-Instruct` (Apache 2.0, ungated; same 7B-instruct class
  as the old HF router model, with strong tool-calling). Llama-3.1-8B-Instruct was
  tried first, but the HF token (solanaminter) hasn't accepted Meta's gated-repo
  license — 403 at download.
- **Runtime:** minimal FastAPI app driving vLLM's `LLM` class directly
  (single engine init; the `vllm serve` CLI re-initialized the engine
  multiple times per container, ~6 min cold start — removed Oct 14).
  Tool calls parsed from the hermes `<tool_call>` format the model emits
  (vLLM 0.30's `LLM` class accepts no `tool_call_parser` kwarg).
- **Critical `web_server` pattern (Oct 14 fix):** the `serve()` function must
  start uvicorn NON-BLOCKING (background thread) and RETURN. Modal builds
  the request proxy only *after* our function returns — a blocking
  `uvicorn.run()`/`subprocess.run()` deadlocks this: the proxy is never
  created, requests hang with zero bytes, and the container is eventually
  killed as "initializing too long" (this was the true root cause of the
  Oct 14 crash loop that burned the 10-GPU quota, not just slow init).
- **Served model name:** `procurepilot-llm` (stable alias; the app sends this as `model:`)
- **GPU:** A10G, `min_containers=0` → scales to zero; billed only while warm
  (~$1.10/hr at deploy time). Cold start ~5–8s to first HTTP 200, ~2–4 min
  to model-ready (weights from the `procurepilot-models` volume).

## Verified live (2026-10-14, production URL)

- `GET /v1/models` → 200 `{"id":"procurepilot-llm",...}` (~1s warm)
- `POST /v1/chat/completions` with `spend_summary` tool → 200,
  `tool_calls=[{"function":{"name":"spend_summary","arguments":"{}"}}]`,
  `finish_reason":"tool_calls"` (~3s warm)
- Two separate cold starts verified (5.6s and 7.9s to first 200;
  4m41s and 2m22s to model-ready); no crash loop, single GPU each time.

## Deploy

From the hack venv (Modal CLI authenticated there):

```bash
cd infra/modal-llm
NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 \
  ~/workspace/.venvs/hack/bin/modal deploy serve.py
```

Populate the weights volume once (CPU-only, no GPU burned) before the first
cold start, so containers skip the ~16 GB download:

```bash
NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 \
  ~/workspace/.venvs/hack/bin/modal run serve.py::download_model
```

Requires the `huggingface` Modal secret (`HF_TOKEN`) for the gated Llama download:

```bash
modal secret create huggingface HF_TOKEN=<your-hf-token>
```

`modal deploy` prints the endpoint URL, e.g.
`https://solanaminter--procurepilot-llm-serve.modal.run`.

## Wire the app

```bash
LLM_BASE_URL=https://<endpoint>/v1
LLM_MODEL=procurepilot-llm
LLM_API_KEY=modal        # vLLM ignores the key; any non-empty value works
```

The Studio harness additionally honors `STUDIO_LLM_BASE_URL` / `STUDIO_LLM_MODEL`
(defaults: the HF router + `meta-llama/Llama-3.1-8B-Instruct`, kept as fallback).

## Sanity check

```bash
curl -s https://<endpoint>/v1/chat/completions \
  -H "Authorization: Bearer modal" -H "Content-Type: application/json" \
  -d '{"model":"procurepilot-llm","messages":[{"role":"user","content":"Say OK"}]}'
```

Tool-calling round trip (the Studio harness's actual usage):

```bash
curl -s https://<endpoint>/v1/chat/completions \
  -H "Authorization: Bearer modal" -H "Content-Type: application/json" \
  -d '{"model":"procurepilot-llm","messages":[{"role":"user","content":"How many orders are pending?"}],
       "tools":[{"type":"function","function":{"name":"spend_summary","description":"Spend totals","parameters":{"type":"object","properties":{}}}}],
       "tool_choice":"auto"}' | python -m json.tool
```

Expect `choices[0].message.tool_calls` with a `spend_summary` function call.
