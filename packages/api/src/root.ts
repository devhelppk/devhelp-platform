import { catalogueRouter } from "./routers/catalogue";
import { learningRouter } from "./routers/learning";
import { createCallerFactory, router } from "./trpc";

export const appRouter = router({
  catalogue: catalogueRouter,
  learning: learningRouter,
});
export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
