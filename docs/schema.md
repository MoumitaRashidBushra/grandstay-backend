**GRANDSTAY HOTEL BOOKING SYSTEM**

Database Schema & Constraint Documentation

# 1. Purpose and scope

This document describes the database keys, constraints, and indexes defined in the GrandStay Hotel Booking System PostgreSQL schema (SRS §5.2). It organizes the details by constraint type and provides a consolidated table-by-table summary for implementation and review.

The supplied DDL contains 10 tables, 10 primary-key constraints, 11 foreign-key constraints, 8 UNIQUE constraints, 11 explicit CHECK constraints, 3 explicitly created regular indexes, and 1 exclusion constraint.

# 2. Primary keys (PK)

A primary key uniquely identifies each row in a table. A primary-key column (or set of columns) cannot contain NULL values, and its values must be unique.

| **Table**        | **Primary key column(s)** | **Notes**        |
| ---------------- | ------------------------- | ---------------- |
| hotel_settings   | id                        | Single-column PK |
| ---              | ---                       | ---              |
| room_categories  | id                        | Single-column PK |
| ---              | ---                       | ---              |
| rooms            | id                        | Single-column PK |
| ---              | ---                       | ---              |
| users            | id                        | Single-column PK |
| ---              | ---                       | ---              |
| bookings         | id                        | Single-column PK |
| ---              | ---                       | ---              |
| payments         | id                        | Single-column PK |
| ---              | ---                       | ---              |
| refunds          | id                        | Single-column PK |
| ---              | ---                       | ---              |
| invoices         | id                        | Single-column PK |
| ---              | ---                       | ---              |
| idempotency_keys | (user_id, key)            | Composite PK     |
| ---              | ---                       | ---              |
| audit_logs       | id                        | Single-column PK |
| ---              | ---                       | ---              |

##

## 2.1 Composite primary key

The idempotency_keys table uses a composite primary key: PRIMARY KEY (user_id, key). The combination of user_id and key must be unique. Neither column can be NULL.

```
PRIMARY KEY (user_id, key)
```

# 3. Foreign keys (FK)

Foreign keys maintain referential integrity by requiring a referenced value to exist in the parent table. The schema defines 11 foreign-key relationships.

| **Child table**  | **FK column**  | **Referenced key**  | **ON DELETE**       |
| ---------------- | -------------- | ------------------- | ------------------- |
| rooms            | category_id    | room_categories(id) | RESTRICT            |
| ---              | ---            | ---                 | ---                 |
| bookings         | customer_id    | users(id)           | RESTRICT            |
| ---              | ---            | ---                 | ---                 |
| bookings         | room_id        | rooms(id)           | RESTRICT            |
| ---              | ---            | ---                 | ---                 |
| bookings         | checked_in_by  | users(id)           | NO ACTION (default) |
| ---              | ---            | ---                 | ---                 |
| bookings         | checked_out_by | users(id)           | NO ACTION (default) |
| ---              | ---            | ---                 | ---                 |
| payments         | booking_id     | bookings(id)        | RESTRICT            |
| ---              | ---            | ---                 | ---                 |
| refunds          | booking_id     | bookings(id)        | RESTRICT            |
| ---              | ---            | ---                 | ---                 |
| invoices         | booking_id     | bookings(id)        | RESTRICT            |
| ---              | ---            | ---                 | ---                 |
| invoices         | issued_by      | users(id)           | NO ACTION (default) |
| ---              | ---            | ---                 | ---                 |
| idempotency_keys | user_id        | users(id)           | NO ACTION (default) |
| ---              | ---            | ---                 | ---                 |
| audit_logs       | actor_id       | users(id)           | NO ACTION (default) |
| ---              | ---            | ---                 | ---                 |

## 3.1 ON DELETE behavior

The DDL explicitly specifies ON DELETE RESTRICT for six foreign keys: rooms.category_id, bookings.customer_id, bookings.room_id, payments.booking_id, refunds.booking_id, and invoices.booking_id. The remaining five foreign keys do not specify an ON DELETE clause, so PostgreSQL uses its default NO ACTION behavior.

For example, rooms.category_id is NOT NULL and references room_categories(id) with ON DELETE RESTRICT. Therefore, each room must reference an existing category, and a category cannot be deleted while a room references it.

# 4. UNIQUE constraints and unique indexes

A UNIQUE constraint prevents duplicate values in the specified column or combination of columns. The supplied DDL defines eight UNIQUE constraints:

| **Table**       | **UNIQUE column(s)** |
| --------------- | -------------------- |
| room_categories | name                 |
| ---             | ---                  |
| rooms           | number               |
| ---             | ---                  |
| users           | email                |
| ---             | ---                  |
| bookings        | reference            |
| ---             | ---                  |
| payments        | booking_id           |
| ---             | ---                  |
| refunds         | booking_id           |
| ---             | ---                  |
| invoices        | number               |
| ---             | ---                  |
| invoices        | booking_id           |
| ---             | ---                  |

PostgreSQL automatically creates a unique index to enforce each UNIQUE constraint. Primary keys are also backed by unique indexes. Therefore, the 10 primary-key constraints and 8 UNIQUE constraints result in 18 supporting unique indexes, assuming the supplied DDL is applied successfully and no indexes are later dropped or replaced.

- Explicit CREATE UNIQUE INDEX statements in the supplied DDL: 0.
- Unique indexes backing primary keys: 10.
- Unique indexes backing UNIQUE constraints: 8.
- The exclusion constraint also creates a supporting GiST index, but that index is not a unique index.

# 5. Regular indexes

In addition to indexes created automatically for primary keys and UNIQUE constraints, the DDL explicitly creates three regular indexes on the bookings table.

| **Index name**    | **Table** | **Indexed column(s)**        | **Type / predicate**                 |
| ----------------- | --------- | ---------------------------- | ------------------------------------ |
| bookings_customer | bookings  | (customer_id, check_in DESC) | Regular B-tree index                 |
| ---               | ---       | ---                          | ---                                  |
| bookings_checkin  | bookings  | (check_in)                   | Partial; WHERE status = 'CONFIRMED'  |
| ---               | ---       | ---                          | ---                                  |
| bookings_checkout | bookings  | (check_out)                  | Partial; WHERE status = 'CHECKED_IN' |
| ---               | ---       | ---                          | ---                                  |

The bookings_checkin and bookings_checkout indexes are partial indexes because they index only rows that satisfy their respective WHERE conditions.

```
CREATE INDEX bookings_customer ON bookings (customer_id, check_in DESC);\nCREATE INDEX bookings_checkin ON bookings (check_in) WHERE status = 'CONFIRMED';\nCREATE INDEX bookings_checkout ON bookings (check_out) WHERE status = 'CHECKED_IN';
```

# 6. CHECK constraints

CHECK constraints validate whether a row satisfies a Boolean condition when it is inserted or updated. The supplied DDL contains 11 explicit CHECK constraints.

| **Table**       | **CHECK expression**                                   | **Purpose**                                                                         |
| --------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| hotel_settings  | id = 1                                                 | Restricts the settings table to the designated id value; it allows at most one row. |
| ---             | ---                                                    | ---                                                                                 |
| room_categories | nightly_price > 0                                      | Nightly price must be positive.                                                     |
| ---             | ---                                                    | ---                                                                                 |
| room_categories | capacity BETWEEN 1 AND 10                              | Capacity must be from 1 through 10.                                                 |
| ---             | ---                                                    | ---                                                                                 |
| users           | mobile ~ '^01\[3-9\]\[0-9\]{8}\$'                      | A non-NULL mobile value must match the specified Bangladesh mobile-number pattern.  |
| ---             | ---                                                    | ---                                                                                 |
| bookings        | guests >= 1                                            | At least one guest is required.                                                     |
| ---             | ---                                                    | ---                                                                                 |
| bookings        | check_out > check_in                                   | Check-out date must be after check-in date.                                         |
| ---             | ---                                                    | ---                                                                                 |
| bookings        | check_out - check_in <= 30                             | A booking cannot exceed 30 nights.                                                  |
| ---             | ---                                                    | ---                                                                                 |
| bookings        | total_amount = nightly_price \* (check_out - check_in) | Total amount must equal nightly price multiplied by the stay duration.              |
| ---             | ---                                                    | ---                                                                                 |
| payments        | amount > 0                                             | Payment amount must be positive.                                                    |
| ---             | ---                                                    | ---                                                                                 |
| payments        | status = 'SUCCEEDED'                                   | Only the SUCCEEDED status is allowed by this CHECK constraint.                      |
| ---             | ---                                                    | ---                                                                                 |
| refunds         | amount >= 0                                            | Refund amount cannot be negative.                                                   |
| ---             | ---                                                    | ---                                                                                 |

Note: The mobile CHECK expression does not by itself make mobile mandatory; the column is nullable in the supplied DDL. A CHECK expression passes when its result is TRUE or NULL.

# 7. Exclusion constraint

The bookings table defines one PostgreSQL exclusion constraint using GiST. It prevents two bookings for the same room from having overlapping stay ranges while both bookings have status CONFIRMED or CHECKED_IN.

```
EXCLUDE USING gist (\n    room_id WITH =,\n    stay WITH &&\n)\nWHERE (status IN ('CONFIRMED', 'CHECKED_IN'));
```

The && operator checks whether two date ranges overlap. The stay column is generated as daterange(check_in, check_out, '\[)'). The '\[)' bounds include the check-in date and exclude the check-out date. Consequently, one guest can check out on the same date another guest checks in without the two stays overlapping.

The btree_gist extension is enabled in the DDL to support GiST equality handling for room_id.

# 8. ENUM types

| **ENUM type**  | **Allowed values**                            | **Used by**     |
| -------------- | --------------------------------------------- | --------------- |
| user_role      | ADMIN, RECEPTIONIST, CUSTOMER                 | users.role      |
| ---            | ---                                           | ---             |
| room_status    | AVAILABLE, MAINTENANCE, RETIRED               | rooms.status    |
| ---            | ---                                           | ---             |
| booking_status | CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED | bookings.status |
| ---            | ---                                           | ---             |

ENUM types restrict a column to the listed set of values. They are separate PostgreSQL types, not CHECK constraints.

# 9. Generated columns

| **Generated column** | **Type**  | **Generation expression**             | **Meaning**                        |
| -------------------- | --------- | ------------------------------------- | ---------------------------------- |
| bookings.stay        | DATERANGE | daterange(check_in, check_out, '\[)') | Stored date range for the booking. |
| ---                  | ---       | ---                                   | ---                                |
| bookings.nights      | SMALLINT  | check_out - check_in                  | Stored number of nights.           |
| ---                  | ---       | ---                                   | ---                                |

These are generated columns, not CHECK constraints. PostgreSQL calculates their values from the source columns according to the generation expressions.

# 10. Consolidated constraints by table

This section provides the table-by-table inventory requested for the schema documentation. It summarizes primary keys, foreign keys, UNIQUE constraints, CHECK constraints, and explicit regular indexes. 'None' means no constraint of that type is defined for that table in the supplied DDL.

| **Table**        | **PK**         | **FK column(s) → referenced table**                                                             | **UNIQUE**         | **CHECK**                                                                                                            | **Explicit regular indexes**                                               |
| ---------------- | -------------- | ----------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| hotel_settings   | id             | None                                                                                            | None               | id = 1                                                                                                               | None                                                                       |
| ---              | ---            | ---                                                                                             | ---                | ---                                                                                                                  | ---                                                                        |
| room_categories  | id             | None                                                                                            | name               | nightly_price > 0; capacity BETWEEN 1 AND 10                                                                         | None                                                                       |
| ---              | ---            | ---                                                                                             | ---                | ---                                                                                                                  | ---                                                                        |
| rooms            | id             | category_id → room_categories.id                                                                | number             | None                                                                                                                 | None                                                                       |
| ---              | ---            | ---                                                                                             | ---                | ---                                                                                                                  | ---                                                                        |
| users            | id             | None                                                                                            | email              | mobile ~ '^01\[3-9\]\[0-9\]{8}\$'                                                                                    | None                                                                       |
| ---              | ---            | ---                                                                                             | ---                | ---                                                                                                                  | ---                                                                        |
| bookings         | id             | customer_id → users.id; room_id → rooms.id; checked_in_by → users.id; checked_out_by → users.id | reference          | guests >= 1; check_out > check_in; check_out - check_in <= 30; total_amount = nightly_price × (check_out - check_in) | bookings_customer; bookings_checkin (partial); bookings_checkout (partial) |
| ---              | ---            | ---                                                                                             | ---                | ---                                                                                                                  | ---                                                                        |
| payments         | id             | booking_id → bookings.id                                                                        | booking_id         | amount > 0; status = 'SUCCEEDED'                                                                                     | None                                                                       |
| ---              | ---            | ---                                                                                             | ---                | ---                                                                                                                  | ---                                                                        |
| refunds          | id             | booking_id → bookings.id                                                                        | booking_id         | amount >= 0                                                                                                          | None                                                                       |
| ---              | ---            | ---                                                                                             | ---                | ---                                                                                                                  | ---                                                                        |
| invoices         | id             | booking_id → bookings.id; issued_by → users.id                                                  | number; booking_id | None                                                                                                                 | None                                                                       |
| ---              | ---            | ---                                                                                             | ---                | ---                                                                                                                  | ---                                                                        |
| idempotency_keys | (user_id, key) | user_id → users.id                                                                              | None               | None                                                                                                                 | None                                                                       |
| ---              | ---            | ---                                                                                             | ---                | ---                                                                                                                  | ---                                                                        |
| audit_logs       | id             | actor_id → users.id                                                                             | None               | None                                                                                                                 | None                                                                       |
| ---              | ---            | ---                                                                                             | ---                | ---                                                                                                                  | ---                                                                        |

# 11. Important scope notes

The following rules are not explicitly enforced by the listed constraints in the supplied DDL. They may be handled by application logic, transactions, triggers, or additional schema constraints, but they should not be described as enforced by this DDL unless implemented elsewhere:

- A booking's guests value does not have a CHECK constraint tying it to the room category capacity.
- The DDL does not enforce that a payment amount equals the booking total_amount.
- The DDL does not enforce that a refund can only be recorded for a cancelled booking or that its amount follows a refund policy.
- The DDL does not enforce that an invoice is issued only at checkout.
- The DDL does not define allowed state transitions for booking_status.
- The DDL does not define CHECK constraints for invoices.total_amount or invoices.paid_amount.

These are observations about the supplied DDL only; they are not necessarily defects if the application enforces the corresponding business rules.