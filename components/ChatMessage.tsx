"use client";

import type { ReactNode } from "react";
import type { ProcureMessage } from "./useProcureChat";

/**
 * Very small markdown-ish renderer: paragraphs, **bold**, `code`,
 * bullet lists (- or *), and numbered lists (1.). No external deps.
 */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(
        <strong key={`${keyPrefix}-${k++}`} className="font-semibold text-neutral-100">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else {
      out.push(
        <code
          key={`${keyPrefix}-${k++}`}
          className="rounded bg-neutral-800 px-1 py-0.5 font-mono text-[0.85em] text-emerald-300"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function AssistantText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (bullet || numbered) {
      const items: string[] = [];
      const ordered = !!numbered;
      while (i < lines.length) {
        const m = lines[i].match(
          ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*]\s+(.*)$/,
        );
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      blocks.push(
        ordered ? (
          <ol key={k++} className="my-2 list-decimal space-y-1 pl-5">
            {items.map((it, j) => (
              <li key={j}>{renderInline(it, `ol-${k}-${j}`)}</li>
            ))}
          </ol>
        ) : (
          <ul key={k++} className="my-2 list-disc space-y-1 pl-5">
            {items.map((it, j) => (
              <li key={j}>{renderInline(it, `ul-${k}-${j}`)}</li>
            ))}
          </ul>
        ));
    } else if (line.trim() === "") {
      i++;
    } else {
      blocks.push(
        <p key={k++} className="my-1.5 leading-relaxed">
          {renderInline(line, `p-${k}`)}
        </p>,
      );
    }
  }
  return <div className="text-[0.95rem] text-neutral-200">{blocks}</div>;
}

export default function ChatMessage({
  message,
  children,
}: {
  message: ProcureMessage;
  children?: ReactNode;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[75%] ${
          isUser
            ? "rounded-br-md bg-emerald-600 text-white"
            : "rounded-bl-md border border-neutral-800 bg-neutral-900 text-neutral-200"
        }`}
      >
        {message.parts.map((part, idx) =>
          part.type === "text" && part.text ? (
            isUser ? (
              <p
                key={idx}
                className="whitespace-pre-wrap text-[0.95rem] leading-relaxed"
              >
                {part.text}
              </p>
            ) : (
              <AssistantText key={idx} text={part.text} />
            )
          ) : null
        )}
        {children}
      </div>
    </div>
  );
}
