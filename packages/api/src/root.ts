import { accountRouter } from "./routers/account";
import { assessmentsRouter } from "./routers/assessments";
import { catalogueRouter } from "./routers/catalogue";
import { learningRouter } from "./routers/learning";
import { mentorRouter } from "./routers/mentor";
import { moderationRouter } from "./routers/moderation";
import { notificationsRouter } from "./routers/notifications";
import { createCallerFactory, router } from "./trpc";

export const appRouter = router({
  catalogue: catalogueRouter,
  assessments: assessmentsRouter,
  learning: learningRouter,
  account: accountRouter,
  mentor: mentorRouter,
  moderation: moderationRouter,
  notifications: notificationsRouter,
});
export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
