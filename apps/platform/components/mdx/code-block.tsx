"use client";

import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { useState, type ComponentProps, type ReactElement } from "react";

/** Collect the plain text of highlighted children so the copy button copies code, not markup. */
function extractText(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return extractText(
      (node as { props: { children?: unknown } }).props.children,
    );
  }
  return "";
}

/** `<pre>` replacement: language label and a copy button over Shiki's build-time highlighting. */
export function CodeBlock(props: ComponentProps<"pre">) {
  const [copied, setCopied] = useState(false);
  const child = props.children as
    ReactElement<{ className?: string; children?: unknown }> | undefined;
  const dataLanguage = (props as { "data-language"?: string })["data-language"];
  const language =
    dataLanguage ?? child?.props?.className?.replace("language-", "") ?? "";
  const text = extractText(child?.props?.children);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="group relative my-5">
      <div className="flex items-center justify-between rounded-t-md border border-b-0 bg-muted px-3 py-1 font-mono text-xs text-muted-foreground">
        <span>{language || "code"}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={copy}
          aria-live="polite"
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre
        {...props}
        className={cn(
          "mt-0 overflow-x-auto rounded-t-none rounded-b-md border p-4 font-mono text-sm leading-relaxed",
          props.className,
        )}
      />
    </div>
  );
}
