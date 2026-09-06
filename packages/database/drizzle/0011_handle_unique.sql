-- `users.handle` is unique, case-insensitively, and only when set. The column
-- comes from the Better Auth generator (schema/auth.ts is overwritten by
-- `auth:generate`), so the index lives here rather than in the schema file.
CREATE UNIQUE INDEX IF NOT EXISTS "users_handle_lower_uidx" ON "users" (lower("handle")) WHERE "handle" IS NOT NULL;
