-- Recovery for the Lab 4 migration (20261101000000_lab4_actions_taken).
-- It removes only the Lab 4 objects; all Lab 1 to 3 data stays.
-- Run it with:
--   npx prisma db execute --file prisma/migrations/20261101000000_lab4_actions_taken/down.sql --schema prisma/schema.prisma
-- Warning: all Actions Taken and status history rows are lost.

DROP TABLE IF EXISTS "ActionTaken";

DROP TABLE IF EXISTS "TicketStatusHistory";

DROP TYPE IF EXISTS "ActionStatus";

DROP INDEX IF EXISTS "Ticket_resolvedAt_idx";

ALTER TABLE "Ticket" DROP COLUMN IF EXISTS "resolvedAt", DROP COLUMN IF EXISTS "version";

DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261101000000_lab4_actions_taken';
