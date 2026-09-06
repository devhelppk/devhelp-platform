import { assessmentsRouter } from "./routers/assessments";
import { catalogueRouter } from "./routers/catalogue";
import { learningRouter } from "./routers/learning";
import { createCallerFactory, router } from "./trpc";

export const appRouter = router({
  catalogue: catalogueRouter,
  assessments: assessmentsRouter,
  learning: learningRouter,
});
export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
