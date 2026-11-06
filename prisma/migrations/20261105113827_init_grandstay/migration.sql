-- Required for the bookings GiST exclusion constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'RECEPTIONIST', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "room_status" AS ENUM ('AVAILABLE', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');

-- CreateTable
CREATE TABLE "hotel_settings" (
    "id" SMALLINT NOT NULL DEFAULT 1,
    "name" VARCHAR(120) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "checkin_time" TIME(6) NOT NULL DEFAULT '14:00'::time,
    "checkout_time" TIME(6) NOT NULL DEFAULT '12:00'::time,
    "timezone" VARCHAR(40) NOT NULL DEFAULT 'Asia/Dhaka',

    CONSTRAINT "hotel_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_categories" (
    "id" SMALLSERIAL NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "nightly_price" DECIMAL(12,2) NOT NULL,
    "capacity" SMALLINT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "facilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" SERIAL NOT NULL,
    "number" VARCHAR(10) NOT NULL,
    "category_id" SMALLINT NOT NULL,
    "floor" SMALLINT NOT NULL,
    "status" "room_status" NOT NULL DEFAULT 'AVAILABLE',
    "status_note" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "mobile" CHAR(11),
    "password_hash" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_reset_pw" BOOLEAN NOT NULL DEFAULT false,
    "failed_logins" SMALLINT NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" BIGSERIAL NOT NULL,
    "reference" CHAR(15) NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "room_id" INTEGER NOT NULL,
    "check_in" DATE NOT NULL,
    "check_out" DATE NOT NULL,
    "stay" DATERANGE GENERATED ALWAYS AS (
        daterange("check_in", "check_out", '[)')
    ) STORED,
    "nights" SMALLINT GENERATED ALWAYS AS (
        ("check_out" - "check_in")::SMALLINT
    ) STORED,
    "guests" SMALLINT NOT NULL,
    "lead_guest_name" VARCHAR(120) NOT NULL,
    "lead_guest_mobile" CHAR(11) NOT NULL,
    "nightly_price" DECIMAL(12,2) NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "status" "booking_status" NOT NULL DEFAULT 'CONFIRMED',
    "confirmed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMPTZ(6),
    "checked_in_at" TIMESTAMPTZ(6),
    "checked_in_by" BIGINT,
    "checked_out_at" TIMESTAMPTZ(6),
    "checked_out_by" BIGINT,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" BIGSERIAL NOT NULL,
    "booking_id" BIGINT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" VARCHAR(20) NOT NULL DEFAULT 'SIMULATED_CARD',
    "card_last4" CHAR(4) NOT NULL,
    "status" VARCHAR(12) NOT NULL DEFAULT 'SUCCEEDED',
    "paid_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" BIGSERIAL NOT NULL,
    "booking_id" BIGINT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" VARCHAR(255) NOT NULL DEFAULT 'Customer cancellation',
    "refunded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" BIGSERIAL NOT NULL,
    "number" CHAR(15) NOT NULL,
    "booking_id" BIGINT NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "paid_amount" DECIMAL(12,2) NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issued_by" BIGINT NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "user_id" BIGINT NOT NULL,
    "key" UUID NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "response_code" SMALLINT,
    "response_body" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("user_id","key")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" BIGINT,
    "action" VARCHAR(60) NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" BIGINT NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "request_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "room_categories_name_key" ON "room_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_number_key" ON "rooms"("number");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_reference_key" ON "bookings"("reference");

-- CreateIndex
CREATE INDEX "bookings_customer" ON "bookings"("customer_id", "check_in" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "payments_booking_id_key" ON "payments"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_booking_id_key" ON "refunds"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_booking_id_key" ON "invoices"("booking_id");

-- CreateIndex: partial indexes for booking operations
CREATE INDEX "bookings_checkin"
ON "bookings"("check_in")
WHERE "status" = 'CONFIRMED';

CREATE INDEX "bookings_checkout"
ON "bookings"("check_out")
WHERE "status" = 'CHECKED_IN';

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "room_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_checked_out_by_fkey" FOREIGN KEY ("checked_out_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Custom CHECK constraints from the GrandStay SRS
ALTER TABLE "hotel_settings"
    ADD CONSTRAINT "hotel_settings_id_check" CHECK ("id" = 1);

ALTER TABLE "room_categories"
    ADD CONSTRAINT "room_categories_nightly_price_check" CHECK ("nightly_price" > 0),
    ADD CONSTRAINT "room_categories_capacity_check" CHECK ("capacity" BETWEEN 1 AND 10);

ALTER TABLE "users"
    ADD CONSTRAINT "users_mobile_format_check"
    CHECK ("mobile" ~ '^01[3-9][0-9]{8}$');

ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_guests_check" CHECK ("guests" >= 1),
    ADD CONSTRAINT "bookings_date_order_check" CHECK ("check_out" > "check_in"),
    ADD CONSTRAINT "bookings_max_nights_check" CHECK ("check_out" - "check_in" <= 30),
    ADD CONSTRAINT "bookings_total_amount_check"
        CHECK ("total_amount" = "nightly_price" * ("check_out" - "check_in"));

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_amount_check" CHECK ("amount" > 0),
    ADD CONSTRAINT "payments_status_check" CHECK ("status" = 'SUCCEEDED');

ALTER TABLE "refunds"
    ADD CONSTRAINT "refunds_amount_check" CHECK ("amount" >= 0);

-- Prevent overlapping active bookings for the same room.
ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_no_overlap"
    EXCLUDE USING gist (
        "room_id" WITH =,
        "stay" WITH &&
    )
    WHERE ("status" IN ('CONFIRMED', 'CHECKED_IN'));
