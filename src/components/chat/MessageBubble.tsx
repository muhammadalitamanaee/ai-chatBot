"use client";

import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useState } from "react";
import type { Message } from "@/types/index";
import remarkGfm from "remark-gfm"; // ← add this

// Copy button for code blocks
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    // Reset after 2 seconds
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-1 right-3 text-xs text-neutral-400 hover:text-white transition-colors px-2 py-1 rounded bg-neutral-700 hover:bg-neutral-600"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex mb-6 ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Avatar — only for assistant */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-neutral-800 dark:bg-neutral-600 text-white flex items-center justify-center text-xs font-medium mr-3 flex-shrink-0 mt-1">
          AI
        </div>
      )}

      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-neutral-800 text-white rounded-br-sm dark:bg-neutral-700"
            : "bg-white border border-neutral-200 text-neutral-800 rounded-bl-sm dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-100"
        }`}
      >
        {isUser ? (
          // User messages — plain text, preserve line breaks
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          // Assistant messages — full markdown rendering
          <div
            className="prose prose-sm dark:prose-invert max-w-none
            prose-p:leading-relaxed prose-p:mb-3 last:prose-p:mb-0
            prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
            prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
            prose-strong:font-semibold
            prose-code:text-pink-600 prose-code:dark:text-pink-400
            prose-code:bg-neutral-100 prose-code:dark:bg-neutral-700
            prose-code:px-1 prose-code:py-0.5 prose-code:rounded
            prose-code:text-xs prose-code:font-mono
            prose-pre:p-0 prose-pre:bg-transparent prose-pre:m-0
          "
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Custom code block renderer with syntax highlighting
                code({ node, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const codeString = String(children).replace(/\n$/, "");
                  const isBlock = !!match;

                  return isBlock ? (
                    // Multi-line code block with syntax highlighting
                    <div className="relative my-3 rounded-xl overflow-hidden">
                      {/* Language label */}
                      <div className="flex items-center justify-between px-4 py-2 bg-neutral-800 dark:bg-neutral-900">
                        <span className="text-xs text-neutral-400 font-mono">
                          {match[1]}
                        </span>
                        <CopyButton text={codeString} />
                      </div>
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{
                          margin: 0,
                          borderRadius: 0,
                          fontSize: "13px",
                          padding: "16px",
                        }}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    // Inline code
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },

                // Open links in new tab
                a({ href, children }) {
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {children}
                    </a>
                  );
                },

                // Style tables
                table({ children }) {
                  return (
                    <div className="overflow-x-auto my-3">
                      <table className="min-w-full border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden text-xs">
                        {children}
                      </table>
                    </div>
                  );
                },
                th({ children }) {
                  return (
                    <th className="px-3 py-2 bg-neutral-100 dark:bg-neutral-700 font-medium text-left border-b border-neutral-200 dark:border-neutral-600">
                      {children}
                    </th>
                  );
                },
                td({ children }) {
                  return (
                    <td className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-700">
                      {children}
                    </td>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>

            {/* Blinking cursor while streaming */}
            {message.isStreaming && (
              <span className="inline-block w-[2px] h-4 bg-neutral-400 ml-0.5 align-middle animate-pulse" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
