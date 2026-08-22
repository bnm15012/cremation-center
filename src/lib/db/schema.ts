import {
  boolean,
  datetime,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id:            int("id").primaryKey().autoincrement(),
  email:         varchar("email", { length: 255 }).notNull().unique(),
  password_hash: varchar("password_hash", { length: 255 }).notNull(),
  full_name:     varchar("full_name", { length: 255 }).notNull().default(""),
  role:          mysqlEnum("role", ["admin", "staff"]).notNull().default("staff"),
  is_active:     boolean("is_active").notNull().default(true),
  created_at:    datetime("created_at").notNull().default(new Date("1970-01-01")),
  updated_at:    datetime("updated_at").notNull().default(new Date("1970-01-01")),
});

export const sessions = mysqlTable("sessions", {
  id:         varchar("id", { length: 64 }).primaryKey(),
  user_id:    int("user_id").notNull().references(() => users.id),
  expires_at: datetime("expires_at").notNull(),
  created_at: datetime("created_at").notNull().default(new Date("1970-01-01")),
});

// ─── Cremation Records ────────────────────────────────────────────────────────

export const recordStatusEnum = mysqlEnum("record_status", [
  "draft",        // saved by staff, not yet submitted
  "submitted",    // staff submitted, awaiting admin review
  "approved",     // admin approved
  "rejected",     // admin rejected (needs correction)
]);

export const cremation_records = mysqlTable("cremation_records", {
  id:                 int("id").primaryKey().autoincrement(),

  // Deceased personal details
  deceased_name:      varchar("deceased_name", { length: 255 }).notNull(),
  date_of_birth:      datetime("date_of_birth"),
  date_of_death:      datetime("date_of_death").notNull(),
  time_of_death:      varchar("time_of_death", { length: 10 }),          // "HH:MM"
  age_at_death:       int("age_at_death"),
  gender:             mysqlEnum("gender", ["male", "female", "other"]),
  nationality:        varchar("nationality", { length: 100 }),
  religion:           varchar("religion", { length: 100 }),

  // Location / ceremony details
  place_of_death:     varchar("place_of_death", { length: 500 }),
  cremation_date:     datetime("cremation_date"),
  cremation_time:     varchar("cremation_time", { length: 10 }),
  funeral_pyre_no:    varchar("funeral_pyre_no", { length: 50 }),

  // Next-of-kin / contact
  next_of_kin_name:   varchar("next_of_kin_name", { length: 255 }),
  next_of_kin_phone:  varchar("next_of_kin_phone", { length: 50 }),
  next_of_kin_relation: varchar("next_of_kin_relation", { length: 100 }),
  next_of_kin_address: text("next_of_kin_address"),

  // Medical / cause of death
  cause_of_death:     text("cause_of_death"),
  doctor_name:        varchar("doctor_name", { length: 255 }),
  hospital_name:      varchar("hospital_name", { length: 255 }),
  death_certificate_no: varchar("death_certificate_no", { length: 100 }),

  // Workflow
  status:             mysqlEnum("record_status", ["draft", "submitted", "approved", "rejected"])
                        .notNull().default("draft"),
  rejection_reason:   text("rejection_reason"),

  // Audit
  created_by:         int("created_by").notNull().references(() => users.id),
  reviewed_by:        int("reviewed_by").references(() => users.id),
  reviewed_at:        datetime("reviewed_at"),
  notes:              text("notes"),

  created_at:         datetime("created_at").notNull().default(new Date("1970-01-01")),
  updated_at:         datetime("updated_at").notNull().default(new Date("1970-01-01")),
});

// ─── Invite Tokens ────────────────────────────────────────────────────────────

export const invite_tokens = mysqlTable("invite_tokens", {
  id:         int("id").primaryKey().autoincrement(),
  token:      varchar("token", { length: 128 }).notNull().unique(),
  email:      varchar("email", { length: 255 }).notNull(),
  full_name:  varchar("full_name", { length: 255 }).notNull(),
  role:       mysqlEnum("role", ["admin", "staff"]).notNull().default("staff"),
  used:       boolean("used").notNull().default(false),
  expires_at: datetime("expires_at").notNull(),
  created_by: int("created_by").notNull().references(() => users.id),
  created_at: datetime("created_at").notNull().default(new Date("1970-01-01")),
});

// ─── Documents ────────────────────────────────────────────────────────────────

export const documents = mysqlTable("documents", {
  id:             int("id").primaryKey().autoincrement(),
  record_id:      int("record_id").notNull().references(() => cremation_records.id),
  file_name:      varchar("file_name", { length: 500 }).notNull(),
  storage_path:   varchar("storage_path", { length: 1000 }).notNull(),
  mime_type:      varchar("mime_type", { length: 255 }),
  file_size:      int("file_size").notNull().default(0),
  document_type:  varchar("document_type", { length: 100 }),   // e.g. "death_certificate", "id_proof"
  uploaded_by:    int("uploaded_by").notNull().references(() => users.id),
  created_at:     datetime("created_at").notNull().default(new Date("1970-01-01")),
});

// ─── AMC / Razorpay Payments ──────────────────────────────────────────────────

export const amc_payments = mysqlTable("amc_payments", {
  id:                     int("id").primaryKey().autoincrement(),
  amount_paise:           int("amount_paise").notNull().default(599900), // ₹5999
  razorpay_order_id:      varchar("razorpay_order_id", { length: 255 }).notNull(),
  razorpay_payment_id:    varchar("razorpay_payment_id", { length: 255 }),
  razorpay_signature:     varchar("razorpay_signature", { length: 500 }),
  status:                 mysqlEnum("payment_status", ["pending", "completed", "failed"])
                              .notNull().default("pending"),
  year:                   int("year").notNull(),
  valid_until:            datetime("valid_until").notNull(),
  paid_at:                datetime("paid_at"),
  paid_by:                int("paid_by").references(() => users.id),
  created_at:             datetime("created_at").notNull().default(new Date("1970-01-01")),
  updated_at:             datetime("updated_at").notNull().default(new Date("1970-01-01")),
});

// ─── Password Reset Tokens ────────────────────────────────────────────────────

export const password_reset_tokens = mysqlTable("password_reset_tokens", {
  id:          int("id").primaryKey().autoincrement(),
  email:       varchar("email", { length: 255 }).notNull(),
  otp:         varchar("otp", { length: 6 }).notNull(),
  used:        boolean("used").notNull().default(false),
  expires_at:  datetime("expires_at").notNull(),
  created_at:  datetime("created_at").notNull().default(new Date("1970-01-01")),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type InviteToken = typeof invite_tokens.$inferSelect;
export type PasswordResetToken = typeof password_reset_tokens.$inferSelect;
export type CremationRecord = typeof cremation_records.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type AmcPayment = typeof amc_payments.$inferSelect;
