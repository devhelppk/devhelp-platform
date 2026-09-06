"use client";

import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useTheme } from "next-themes";

const surface = EditorView.theme({
  "&": {
    fontSize: "0.875rem",
    backgroundColor: "var(--muted)",
    color: "var(--foreground)",
  },
  ".cm-content": {
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
    padding: "0.75rem 0",
  },
  ".cm-gutters": {
    backgroundColor: "var(--muted)",
    color: "var(--muted-foreground)",
    borderRight: "1px solid var(--border)",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in oklch, var(--primary) 8%, transparent)",
  },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "color-mix(in oklch, var(--primary) 22%, transparent)",
  },
});

export function CodeEditor({
  value,
  language,
  onChange,
  readOnly = false,
  ariaLabel,
}: {
  value: string;
  language: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  ariaLabel: string;
}) {
  const { resolvedTheme } = useTheme();
  const lang =
    language === "python"
      ? python()
      : javascript({
          typescript: language === "typescript" || language === "react",
          jsx: language === "react",
        });
  return (
    <CodeMirror
      value={value}
      height="auto"
      minHeight="12rem"
      maxHeight="36rem"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      extensions={[lang, surface, EditorView.lineWrapping]}
      readOnly={readOnly}
      editable={!readOnly}
      onChange={(v) => onChange?.(v)}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: !readOnly,
        autocompletion: false,
      }}
      aria-label={ariaLabel}
    />
  );
}
