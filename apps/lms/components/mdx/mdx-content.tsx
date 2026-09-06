import { MDXContent as Runtime } from "@content-collections/mdx/react";
import type { ComponentProps } from "react";
import { Callout } from "./callout";
import { CodeBlock } from "./code-block";

const components = {
  Callout,
  pre: CodeBlock,
};

/** Renders a compiled lesson body with the design system's prose styles. */
export function MDXContent({ code }: { code: string }) {
  return (
    <div className="prose-lesson">
      <Runtime code={code} components={components} />
    </div>
  );
}

export type MDXComponents = ComponentProps<typeof Runtime>["components"];
