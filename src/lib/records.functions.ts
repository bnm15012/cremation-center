import { createServerFn } from "@tanstack/react-start";
import { eq, desc, and, or, like, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "@/lib/auth-middleware";
import { deleteFileByPath } from "@/lib/storage";

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function assertAmcActive() {
  const { getDb } = await import("@/lib/db");
  const { amc_payments } = await import("@/lib/db/schema");
  const db = getDb();

  const [latest] = await db
    .select()
    .from(amc_payments)
    .where(eq(amc_payments.status, "completed"))
    .orderBy(desc(amc_payments.valid_until))
    .limit(1);

  if (!latest || new Date(latest.valid_until) <= new Date()) {
    throw new Error("AMC plan expired. Please renew to perform this action.");
  }
}

// ── List records ──────────────────────────────────────────────────────────────
export const listRecords = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d: { search?: string; status?: string; role?: string; userId?: string }) => d)
  .handler(async ({ data, context }) => {
    const { getDb } = await import("@/lib/db");
    const { cremation_records, users } = await import("@/lib/db/schema");

    const db = getDb();
    const userId = Number(context.userId);

    // Fetch user role
    const [me] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const isAdmin = me?.role === "admin";

    const conditions = [];

    // Staff can only see their own records
    if (!isAdmin) {
      conditions.push(eq(cremation_records.created_by, userId));
    }

    if (data.status && data.status !== "all") {
      conditions.push(eq(cremation_records.status, data.status as any));
    }

    if (data.search) {
      conditions.push(
        or(
          like(cremation_records.deceased_name, `%${data.search}%`),
          like(cremation_records.next_of_kin_name, `%${data.search}%`),
          like(cremation_records.death_certificate_no, `%${data.search}%`)
        )
      );
    }

    const rows = await db
      .select({
        id: cremation_records.id,
        deceased_name: cremation_records.deceased_name,
        date_of_birth: cremation_records.date_of_birth,
        date_of_death: cremation_records.date_of_death,
        time_of_death: cremation_records.time_of_death,
        status: cremation_records.status,
        cremation_date: cremation_records.cremation_date,
        next_of_kin_name: cremation_records.next_of_kin_name,
        created_at: cremation_records.created_at,
        created_by_name: users.full_name,
      })
      .from(cremation_records)
      .leftJoin(users, eq(cremation_records.created_by, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(cremation_records.created_at))
      .limit(200);

    return { records: rows, isAdmin };
  });

// ── Get single record ─────────────────────────────────────────────────────────
export const getRecord = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d: { id: number }) => d)
  .handler(async ({ data, context }) => {
    const { getDb } = await import("@/lib/db");
    const { cremation_records, users, documents } = await import("@/lib/db/schema");

    const db = getDb();
    const userId = Number(context.userId);

    const [record] = await db
      .select()
      .from(cremation_records)
      .where(eq(cremation_records.id, data.id))
      .limit(1);

    if (!record) throw new Error("Record not found");

    const [me] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const isAdmin = me?.role === "admin";

    // Staff can only view their own records
    if (!isAdmin && record.created_by !== userId) {
      throw new Error("Forbidden");
    }

    const [creator] = await db
      .select({ full_name: users.full_name })
      .from(users)
      .where(eq(users.id, record.created_by))
      .limit(1);

    let reviewer = null;
    if (record.reviewed_by) {
      const [r] = await db
        .select({ full_name: users.full_name })
        .from(users)
        .where(eq(users.id, record.reviewed_by))
        .limit(1);
      reviewer = r;
    }

    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.record_id, data.id))
      .orderBy(desc(documents.created_at));

    return {
      record,
      creator: creator?.full_name ?? "Unknown",
      reviewer: reviewer?.full_name ?? null,
      documents: docs,
      isAdmin,
    };
  });

// ── Create record ─────────────────────────────────────────────────────────────
export const createRecord = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: {
    deceased_name: string;
    date_of_birth?: string;
    date_of_death: string;
    time_of_death?: string;
    age_at_death?: number;
    age_at_death_unit?: "years" | "months";
    gender?: "male" | "female" | "other";
    nationality?: string;
    religion?: string;
    place_of_death?: string;
    cremation_date?: string;
    cremation_time?: string;
    funeral_pyre_no?: string;
    next_of_kin_name?: string;
    next_of_kin_phone?: string;
    next_of_kin_relation?: string;
    next_of_kin_address?: string;
    cause_of_death?: string;
    doctor_name?: string;
    hospital_name?: string;
    death_certificate_no?: string;
    notes?: string;
    status?: "draft" | "submitted";
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAmcActive();

    const { getDb } = await import("@/lib/db");
    const { cremation_records } = await import("@/lib/db/schema");

    const db = getDb();
    const userId = Number(context.userId);
    const now = new Date();

    const [result] = await db.insert(cremation_records).values({
      deceased_name: data.deceased_name,
      date_of_birth: data.date_of_birth ? new Date(data.date_of_birth) : undefined,
      date_of_death: new Date(data.date_of_death),
      time_of_death: data.time_of_death,
      age_at_death: data.age_at_death,
      age_at_death_unit: data.age_at_death_unit ?? "years",
      gender: data.gender,
      nationality: data.nationality,
      religion: data.religion,
      place_of_death: data.place_of_death,
      cremation_date: data.cremation_date ? new Date(data.cremation_date) : undefined,
      cremation_time: data.cremation_time,
      funeral_pyre_no: data.funeral_pyre_no,
      next_of_kin_name: data.next_of_kin_name,
      next_of_kin_phone: data.next_of_kin_phone,
      next_of_kin_relation: data.next_of_kin_relation,
      next_of_kin_address: data.next_of_kin_address,
      cause_of_death: data.cause_of_death,
      doctor_name: data.doctor_name,
      hospital_name: data.hospital_name,
      death_certificate_no: data.death_certificate_no,
      notes: data.notes,
      status: data.status ?? "draft",
      created_by: userId,
      created_at: now,
      updated_at: now,
    });

    const recordId = Number((result as any).insertId);

    return { id: recordId };
  });

// ── Update record ─────────────────────────────────────────────────────────────
export const updateRecord = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: {
    id: number;
    deceased_name?: string;
    date_of_birth?: string;
    date_of_death?: string;
    time_of_death?: string;
    age_at_death?: number;
    age_at_death_unit?: "years" | "months";
    gender?: "male" | "female" | "other";
    nationality?: string;
    religion?: string;
    place_of_death?: string;
    cremation_date?: string;
    cremation_time?: string;
    funeral_pyre_no?: string;
    next_of_kin_name?: string;
    next_of_kin_phone?: string;
    next_of_kin_relation?: string;
    next_of_kin_address?: string;
    cause_of_death?: string;
    doctor_name?: string;
    hospital_name?: string;
    death_certificate_no?: string;
    notes?: string;
    status?: "draft" | "submitted";
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAmcActive();

    const { getDb } = await import("@/lib/db");
    const { cremation_records, users } = await import("@/lib/db/schema");

    const db = getDb();
    const userId = Number(context.userId);
    const now = new Date();

    const [record] = await db
      .select()
      .from(cremation_records)
      .where(eq(cremation_records.id, data.id))
      .limit(1);

    if (!record) throw new Error("Record not found");

    const [me] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const isAdmin = me?.role === "admin";

    // Staff can edit their own records until approved
    if (!isAdmin) {
      if (record.created_by !== userId) throw new Error("Forbidden");
      if (record.status === "approved") {
        throw new Error("Cannot edit an approved record");
      }
    }

    const { id, ...fields } = data;

    await db
      .update(cremation_records)
      .set({
        ...fields,
        date_of_birth: fields.date_of_birth ? new Date(fields.date_of_birth) : undefined,
        date_of_death: fields.date_of_death ? new Date(fields.date_of_death) : undefined,
        cremation_date: fields.cremation_date ? new Date(fields.cremation_date) : undefined,
        updated_at: now,
      })
      .where(eq(cremation_records.id, data.id));

    return { success: true };
  });

// ── Submit record (staff → admin) ─────────────────────────────────────────────
export const submitRecord = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: { id: number }) => d)
  .handler(async ({ data, context }) => {
    await assertAmcActive();

    const { getDb } = await import("@/lib/db");
    const { cremation_records } = await import("@/lib/db/schema");

    const db = getDb();
    const userId = Number(context.userId);
    const now = new Date();

    const [record] = await db
      .select()
      .from(cremation_records)
      .where(eq(cremation_records.id, data.id))
      .limit(1);

    if (!record) throw new Error("Record not found");
    if (record.created_by !== userId) throw new Error("Forbidden");
    if (record.status !== "draft" && record.status !== "rejected") {
      throw new Error("Only draft or rejected records can be submitted");
    }

    await db
      .update(cremation_records)
      .set({ status: "submitted", updated_at: now })
      .where(eq(cremation_records.id, data.id));

    return { success: true };
  });

// ── Approve record (admin) ────────────────────────────────────────────────────
export const approveRecord = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((d: { id: number }) => d)
  .handler(async ({ data, context }) => {
    await assertAmcActive();

    const { getDb } = await import("@/lib/db");
    const { cremation_records } = await import("@/lib/db/schema");

    const db = getDb();
    const userId = Number(context.userId);
    const now = new Date();

    await db
      .update(cremation_records)
      .set({ status: "approved", reviewed_by: userId, reviewed_at: now, updated_at: now })
      .where(eq(cremation_records.id, data.id));

    return { success: true };
  });

// ── Reject record (admin) ─────────────────────────────────────────────────────
export const rejectRecord = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((d: { id: number; reason: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAmcActive();

    const { getDb } = await import("@/lib/db");
    const { cremation_records } = await import("@/lib/db/schema");

    const db = getDb();
    const userId = Number(context.userId);
    const now = new Date();

    await db
      .update(cremation_records)
      .set({
        status: "rejected",
        rejection_reason: data.reason,
        reviewed_by: userId,
        reviewed_at: now,
        updated_at: now,
      })
      .where(eq(cremation_records.id, data.id));

    return { success: true };
  });

// ── Save document metadata after upload ──────────────────────────────────────
export const saveDocument = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    (d: {
      recordId: number;
      fileName: string;
      storagePath: string;
      mimeType: string;
      fileSize: number;
      documentType?: string;
    }) => d
  )
  .handler(async ({ data, context }) => {
    await assertAmcActive();

    const { getDb } = await import("@/lib/db");
    const { documents } = await import("@/lib/db/schema");

    const db = getDb();
    const userId = Number(context.userId);
    const now = new Date();

    await db.insert(documents).values({
      record_id: data.recordId,
      file_name: data.fileName,
      storage_path: data.storagePath,
      mime_type: data.mimeType,
      file_size: data.fileSize,
      document_type: data.documentType,
      uploaded_by: userId,
      created_at: now,
    });

    return { success: true };
  });

// ── Delete document ───────────────────────────────────────────────────────────
export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: { documentId: number }) => d)
  .handler(async ({ data, context }) => {
    await assertAmcActive();

    const { getDb } = await import("@/lib/db");
    const { documents, cremation_records, users } = await import("@/lib/db/schema");

    const db = getDb();
    const userId = Number(context.userId);
    const now = new Date();

    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, data.documentId))
      .limit(1);

    if (!doc) throw new Error("Document not found");

    const [me] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const isAdmin = me?.role === "admin";

    if (!isAdmin && doc.uploaded_by !== userId) {
      throw new Error("Forbidden");
    }

    await db.delete(documents).where(eq(documents.id, data.documentId));

    return { storagePath: doc.storage_path };
  });

// ── Dashboard stats (admin) ───────────────────────────────────────────────────
export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { getDb } = await import("@/lib/db");
    const { cremation_records, users } = await import("@/lib/db/schema");

    const db = getDb();
    const userId = Number(context.userId);

    const [me] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const isAdmin = me?.role === "admin";

    const allRecords = await db
      .select({ status: cremation_records.status })
      .from(cremation_records)
      .where(isAdmin ? undefined : eq(cremation_records.created_by, userId));

    const stats = {
      total: allRecords.length,
      draft: allRecords.filter((r) => r.status === "draft").length,
      submitted: allRecords.filter((r) => r.status === "submitted").length,
      approved: allRecords.filter((r) => r.status === "approved").length,
      rejected: allRecords.filter((r) => r.status === "rejected").length,
    };

    return { stats, isAdmin };
  });

// ── List staff users (admin) ──────────────────────────────────────────────────
export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { getDb } = await import("@/lib/db");
    const { users } = await import("@/lib/db/schema");

    const db = getDb();

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        full_name: users.full_name,
        role: users.role,
        is_active: users.is_active,
        created_at: users.created_at,
      })
      .from(users)
      .orderBy(desc(users.created_at));

    return { users: rows };
  });

// ── Toggle user active (admin) ────────────────────────────────────────────────
export const toggleUserActive = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((d: { userId: number; isActive: boolean }) => d)
  .handler(async ({ data }) => {
    const { getDb } = await import("@/lib/db");
    const { users } = await import("@/lib/db/schema");

    await getDb()
      .update(users)
      .set({ is_active: data.isActive, updated_at: new Date() })
      .where(eq(users.id, data.userId));

    return { success: true };
  });

// ── Delete record (admin only) ────────────────────────────────────────────────
export const deleteRecord = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((d: { recordId: number }) => d)
  .handler(async ({ data }) => {
    await assertAmcActive();

    const { getDb } = await import("@/lib/db");
    const { cremation_records, documents } = await import("@/lib/db/schema");
    const db = getDb();

    const docs = await db
      .select({ id: documents.id, storage_path: documents.storage_path })
      .from(documents)
      .where(eq(documents.record_id, data.recordId));

    for (const doc of docs) {
      await deleteFileByPath(doc.storage_path);
    }

    await db.transaction(async (tx) => {
      await tx.delete(documents).where(eq(documents.record_id, data.recordId));
      await tx.delete(cremation_records).where(eq(cremation_records.id, data.recordId));
    });

    return { success: true };
  });
