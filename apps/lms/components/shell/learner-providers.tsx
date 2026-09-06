import type { ReactNode } from "react";
import { TRPCReactProvider } from "@/lib/trpc/client";

/** Wrap pages that render progress islands (enrol, mark done, video). */
export function LearnerProviders({ children }: { children: ReactNode }) {
  return <TRPCReactProvider>{children}</TRPCReactProvider>;
}
