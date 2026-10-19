# One-off probe: verify the deployed endpoint serves OpenAI-compatible
# responses (run from Modal's network, bypassing the sandbox egress proxy).
# Usage: modal run infra/modal-llm/probe.py  (from the hack venv)
import json
import modal

app = modal.App("procurepilot-llm-probe")

ENDPOINT = "https://solanaminter--procurepilot-llm-serve.us-east.modal.run"


@app.function(timeout=600)
def check():
    import urllib.request

    def post(path, payload):
        req = urllib.request.Request(
            ENDPOINT + path,
            data=json.dumps(payload).encode(),
            headers={"Authorization": "Bearer modal", "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.status, json.loads(r.read())

    status, models = post("/v1/models", {})
    print("MODELS:", status, [m["id"] for m in models.get("data", [])])

    status, chat = post(
        "/v1/chat/completions",
        {
            "model": "procurepilot-llm",
            "messages": [{"role": "user", "content": "Reply with exactly: LIVE-OK"}],
            "max_tokens": 32,
            "temperature": 0,
        },
    )
    print("CHAT:", status, repr(chat["choices"][0]["message"]["content"]))

    status, tc = post(
        "/v1/chat/completions",
        {
            "model": "procurepilot-llm",
            "messages": [
                {"role": "user", "content": "Use the spend_summary tool to report how many orders exist."}
            ],
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "spend_summary",
                        "description": "Spend totals",
                        "parameters": {"type": "object", "properties": {}},
                    },
                }
            ],
            "tool_choice": "auto",
            "max_tokens": 256,
            "temperature": 0,
        },
    )
    msg = tc["choices"][0]["message"]
    print("TOOLCALL:", status, "tool_calls=", json.dumps(msg.get("tool_calls")))
    print("TOOLCALL text:", repr((msg.get("content") or "")[:120]))


@app.local_entrypoint()
def main():
    check.remote()
