import { router } from "../trpc";
import { authRouter } from "./auth";
import { changeRequestRouter } from "./changeRequest";
import { clientRouter } from "./client";
import { magicLinkRouter } from "./magicLink";
import { projectRouter } from "./project";
import { scopeCardRouter } from "./scopeCard";

import { notificationRouter } from "./notification";

export const appRouter = router({
  auth: authRouter,
  project: projectRouter,
  scopeCard: scopeCardRouter,
  magicLink: magicLinkRouter,
  client: clientRouter,
  changeRequest: changeRequestRouter,
  notification: notificationRouter,
});

export type AppRouter = typeof appRouter;
