-- GrandStay: drop every migrated table and everything attached to them.
-- DESTRUCTIVE: deletes all data. Development use only.
--
-- Run:  psql -U USER -h localhost -d DBNAME -f prisma/drop_all.sql
--
-- Dropping a table also removes its indexes, CHECK constraints, the
-- bookings_no_overlap EXCLUDE constraint, foreign keys, generated columns
-- and id sequences. CASCADE covers the foreign keys between the tables.

BEGIN;

DROP TABLE IF EXISTS "audit_logs"        CASCADE;
DROP TABLE IF EXISTS "idempotency_keys"  CASCADE;
DROP TABLE IF EXISTS "invoices"          CASCADE;
DROP TABLE IF EXISTS "refunds"           CASCADE;
DROP TABLE IF EXISTS "payments"          CASCADE;
DROP TABLE IF EXISTS "bookings"          CASCADE;
DROP TABLE IF EXISTS "rooms"             CASCADE;
DROP TABLE IF EXISTS "room_categories"   CASCADE;
DROP TABLE IF EXISTS "users"             CASCADE;
DROP TABLE IF EXISTS "hotel_settings"    CASCADE;

-- Enum types (must go after the tables that use them)
DROP TYPE IF EXISTS "booking_status" CASCADE;
DROP TYPE IF EXISTS "room_status"    CASCADE;
DROP TYPE IF EXISTS "user_role"      CASCADE;

-- Prisma's migration history. Without this, `migrate deploy` thinks the
-- migrations are already applied and will not recreate the tables.
DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;

-- Optional: also remove the extension used by the EXCLUDE constraint.
-- DROP EXTENSION IF EXISTS btree_gist;

COMMIT;
