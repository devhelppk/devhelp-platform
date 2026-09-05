"use client";

import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  inferAdditionalFields,
  inferOrgAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins";
import type { Auth } from "./server";

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<Auth>(),
    adminClient(),
    organizationClient({
      teams: { enabled: true },
      schema: inferOrgAdditionalFields<Auth>(),
    }),
  ],
});

export const { useSession, signIn, signUp, signOut, useActiveOrganization } =
  authClient;
