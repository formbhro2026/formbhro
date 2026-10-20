import React from "react";
import { cn } from "@/lib/utils";

interface FormattedNewsDescriptionProps {
  description?: string | null;
  className?: string;
  clampLines?: number;
}

/**
 * Renders a news/vacancy description preserving exact formatting:
 * - Preserves paragraphs and spacing between paragraphs
 * - Preserves all single line breaks and indentation
 * - Highlights section headings, emojis, and labels nicely
 * - Indents bullet points and numbered lists cleanly
 */
export function FormattedNewsDescription({
  description,
  className,
  clampLines,
}: FormattedNewsDescriptionProps) {
  if (!description) return null;

  // Normalize Windows CRLF and CR to LF
  const normalized = description.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return null;

  // Split into distinct paragraph blocks on two or more consecutive newlines
  const paragraphs = normalized.split(/\n{2,}/);

  return (
    <div
      className={cn(
        "space-y-3 text-xs sm:text-sm text-text-secondary leading-relaxed select-text",
        clampLines ? `line-clamp-${clampLines}` : "",
        className,
      )}
    >
      {paragraphs.map((para, pIdx) => {
        // Individual lines inside this paragraph
        const lines = para.split("\n");

        return (
          <div key={pIdx} className="space-y-1">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();

              // Heading detection: starts with markdown header, emoji header, or short label ending with colon
              const isHeading =
                /^([#]{1,4}\s+|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|\ud83c[\udf00-\udfff]|\ud83d[\ud000-\ude4f\ude80-\udeff]|\ud83e[\udd00-\uddff])/u.test(
                  trimmed,
                ) ||
                (trimmed.endsWith(":") && trimmed.length < 90 && !trimmed.includes("http"));

              // Bullet detection: starts with -, *, •, or numbered item 1., 2., etc.
              const isBullet = /^([-*•]|\d+[.)])\s+/.test(trimmed);

              return (
                <div
                  key={lIdx}
                  className={cn(
                    "whitespace-pre-wrap break-words",
                    isHeading
                      ? "font-bold text-text pt-1 first:pt-0"
                      : isBullet
                        ? "pl-2 text-text/95"
                        : "text-text-secondary",
                  )}
                >
                  {line}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
