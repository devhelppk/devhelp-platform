import { appRouter, createContext } from "@repo/api";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req.headers),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) =>
            console.error(`tRPC ${path ?? "<no-path>"}: ${error.message}`)
        : undefined,
  });

export { handler as GET, handler as POST };
