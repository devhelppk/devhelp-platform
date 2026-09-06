"use client";

import { useState, type ComponentProps, type ReactElement } from "react";
import { Button } from "@repo/ui/components/button";

/** `<pre>` replacement: language label and a copy button. Highlighting is added in S3. */
export function CodeBlock(props: ComponentProps<"pre">) {
  const [copied, setCopied] = useState(false);
  const child = props.children as
    ReactElement<{ className?: string; children?: string }> | undefined;
  const language = child?.props?.className?.replace("language-", "") ?? "";
  const text =
    typeof child?.props?.children === "string" ? child.props.children : "";

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
        className="mt-0 overflow-x-auto rounded-t-none rounded-b-md border bg-muted p-4 font-mono text-sm leading-relaxed"
      />
    </div>
  );
}
