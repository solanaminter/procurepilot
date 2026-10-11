"use client";

// Minimal useChat-compatible hook for the `ai` v6 SDK.
//
// The `ai` package (v6, installed here) no longer ships `useChat` — that hook
// lives in `@ai-sdk/react`, which is not installed. This hook speaks the exact
// same protocol as `useChat`:
//   - POSTs `{ messages, trigger }` to /api/chat via `DefaultChatTransport`
//     (same payload shape `useChat` sends)
//   - consumes the SSE UI-message stream with `readUIMessageStream`
//   - exposes `messages: ProcureMessage[]` whose `parts` carry the contract's
//     data parts: `data-intent`, `data-offers`, `data-comparison`,
//     `data-orderProposal`
// so the teammate's /api/chat route (built against `useChat`) works unchanged.

import { useCallback, useRef, useState } from "react";
import {
  DefaultChatTransport,
  readUIMessageStream,
  type ChatStatus,
  type UIMessage,
} from "ai";
import type {
  ComparisonResult,
  OrderLine,
  ProcurementIntent,
  ProductOffer,
} from "../lib/adapters/types";

/** Data parts emitted by POST /api/chat, per the team contract. */
export type ProcureDataParts = {
  intent: ProcurementIntent;
  offers: ProductOffer[];
  comparison: ComparisonResult;
  orderProposal: { lines: OrderLine[]; totalCents: number };
}

export type ProcureMessage = UIMessage<unknown, ProcureDataParts>;

let idCounter = 0;
const nextId = () =>
  `msg-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

export interface ProcureChat {
  messages: ProcureMessage[];
  status: ChatStatus;
  error: Error | undefined;
  sendMessage: (text: string) => Promise<void>;
  appendAssistantText: (text: string) => void;
  stop: () => void;
  clearError: () => void;
}

export function useProcureChat(): ProcureChat {
  const [messages, setMessages] = useState<ProcureMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState<Error | undefined>();

  const messagesRef = useRef<ProcureMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const chatIdRef = useRef<string | null>(null);
  if (!chatIdRef.current) {
    chatIdRef.current = `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
  const transportRef = useRef<DefaultChatTransport<ProcureMessage> | null>(
    null,
  );
  if (!transportRef.current) {
    transportRef.current = new DefaultChatTransport<ProcureMessage>({
      api: "/api/chat",
    });
  }

  const updateMessages = useCallback(
    (updater: (prev: ProcureMessage[]) => ProcureMessage[]) => {
      setMessages((prev) => {
        const next = updater(prev);
        messagesRef.current = next;
        return next;
      });
    },
    [],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || abortRef.current) return;

      const controller = new AbortController();
      abortRef.current = controller;
      setError(undefined);
      setStatus("submitted");

      const userMessage: ProcureMessage = {
        id: nextId(),
        role: "user",
        parts: [{ type: "text", text: trimmed }],
      };
      const history = [...messagesRef.current, userMessage];
      updateMessages(() => history);

      try {
        const chunkStream = await transportRef.current!.sendMessages({
          trigger: "submit-message",
          chatId: chatIdRef.current!,
          messageId: userMessage.id,
          messages: history,
          abortSignal: controller.signal,
        });
        setStatus("streaming");

        const assistantMessage: ProcureMessage = {
          id: nextId(),
          role: "assistant",
          parts: [],
        };
        updateMessages((prev) => [...prev, assistantMessage]);

        for await (const snapshot of readUIMessageStream<ProcureMessage>({
          stream: chunkStream,
          onError: (e) =>
            setError(e instanceof Error ? e : new Error(String(e))),
        })) {
          updateMessages((prev) =>
            prev.map((m) => (m.id === assistantMessage.id ? snapshot : m)),
          );
        }
        setStatus("ready");
      } catch (e) {
        if (
          e instanceof Error &&
          (e.name === "AbortError" || controller.signal.aborted)
        ) {
          setStatus("ready");
        } else {
          setError(
            e instanceof Error ? e : new Error("Chat request failed"),
          );
          setStatus("error");
        }
      } finally {
        abortRef.current = null;
      }
    },
    [updateMessages],
  );

  const appendAssistantText = useCallback(
    (text: string) => {
      const message: ProcureMessage = {
        id: nextId(),
        role: "assistant",
        parts: [{ type: "text", text }],
      };
      updateMessages((prev) => [...prev, message]);
    },
    [updateMessages],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearError = useCallback(() => setError(undefined), []);

  return {
    messages,
    status,
    error,
    sendMessage,
    appendAssistantText,
    stop,
    clearError,
  };
}
