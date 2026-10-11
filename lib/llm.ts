// ProcurePilot — model factory (Phase 1).
//
// In mock mode (the default) the chat route uses canned responses and never
// calls getModel(). With MOCK_MODE=false and LLM_API_KEY set, getModel()
// returns an OpenAI-compatible chat model via @ai-sdk/openai, honoring
// LLM_BASE_URL / LLM_MODEL for OpenAI-compatible endpoints.
//
// NOTE: the installed Vercel AI SDK is v6, where the model interface is
// exported as `LanguageModel` (the old `LanguageModelV1` name is gone).

import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { isMockMode } from "./adapters";

export { isMockMode };

export function getModel(): LanguageModel {
  if (isMockMode()) {
    throw new Error(
      "getModel() is not available in mock mode (MOCK_MODE is not 'false'). " +
        "The chat route uses canned responses instead.",
    );
  }
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "LLM_API_KEY is not set. Set it (with MOCK_MODE=false) to use a real model.",
    );
  }
  const baseURL = process.env.LLM_BASE_URL || undefined;
  const modelId = process.env.LLM_MODEL || "gpt-4o-mini";
  return createOpenAI({ apiKey, baseURL })(modelId);
}
