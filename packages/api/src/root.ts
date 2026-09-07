import { accountRouter } from "./routers/account";
import { assessmentsRouter } from "./routers/assessments";
import { badgesRouter } from "./routers/badges";
import { catalogueRouter } from "./routers/catalogue";
import { claimsRouter } from "./routers/claims";
import { certificatesRouter } from "./routers/certificates";
import { commentsRouter } from "./routers/comments";
import { companiesRouter } from "./routers/companies";
import { contributionsRouter } from "./routers/contributions";
import { feedbackRouter } from "./routers/feedback";
import { learningRouter } from "./routers/learning";
import { mentorRouter } from "./routers/mentor";
import { moderationRouter } from "./routers/moderation";
import { notificationsRouter } from "./routers/notifications";
import { profilesRouter } from "./routers/profiles";
import { reviewsRouter } from "./routers/reviews";
import { contributorsRouter, studioRouter } from "./routers/studio";
import { createCallerFactory, router } from "./trpc";

export const appRouter = router({
  catalogue: catalogueRouter,
  claims: claimsRouter,
  assessments: assessmentsRouter,
  learning: learningRouter,
  account: accountRouter,
  mentor: mentorRouter,
  moderation: moderationRouter,
  notifications: notificationsRouter,
  feedback: feedbackRouter,
  reviews: reviewsRouter,
  studio: studioRouter,
  contributors: contributorsRouter,
  comments: commentsRouter,
  companies: companiesRouter,
  contributions: contributionsRouter,
  certificates: certificatesRouter,
  badges: badgesRouter,
  profiles: profilesRouter,
});
export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
