import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { requireAuth } from "@/lib/auth-middleware";
import { getDb } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import {
  client_assignments,
  clients,
  document_comments,
  document_files,
  document_requests,
  financial_years,
  profiles,
  request_items,
  user_roles,
} from "@/lib/db/schema";
import { getUserTenant } from "@/lib/db/helpers";

export const getClientDetail = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z.object({ clientId: z.number().int().positive() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const { clientId } = data;

    const [clientRows, assignmentRows, memberRows, requestRows] =
      await Promise.all([
        db
          .select()
          .from(clients)
          .where(and(eq(clients.id, clientId), eq(clients.tenant_id, tenantId)))
          .limit(1),
        db
          .select({ user_id: client_assignments.user_id })
          .from(client_assignments)
          .where(
            and(
              eq(client_assignments.client_id, clientId),
              eq(client_assignments.tenant_id, tenantId)
            )
          ),
        db
          .select({ user_id: user_roles.user_id, role: user_roles.role })
          .from(user_roles)
          .where(
            and(
              eq(user_roles.tenant_id, tenantId),
              inArray(user_roles.role, ["manager", "staff"])
            )
          ),
        db
          .select({
            id: document_requests.id,
            title: document_requests.title,
            status: document_requests.status,
            created_at: document_requests.created_at,
            financial_year_id: document_requests.financial_year_id,
            client_id: document_requests.client_id,
          })
          .from(document_requests)
          .where(
            and(
              eq(document_requests.client_id, clientId),
              eq(document_requests.tenant_id, tenantId)
            )
          )
          .orderBy(desc(document_requests.created_at)),
      ]);

    const client = clientRows[0] ?? null;

    // Fetch profiles for members
    const memberIds = memberRows.map((m) => m.user_id);
    const profileRows = memberIds.length
      ? await db
          .select({ id: profiles.id, full_name: profiles.full_name })
          .from(profiles)
          .where(inArray(profiles.id, memberIds))
      : [];

    // Fetch financial year labels for requests
    const fyIds = [...new Set(requestRows.map((r) => r.financial_year_id))];
    const fyRows = fyIds.length
      ? await db
          .select({ id: financial_years.id, label: financial_years.label })
          .from(financial_years)
          .where(inArray(financial_years.id, fyIds))
      : [];
    const fyMap = new Map(fyRows.map((f) => [f.id, f.label]));

    return {
      client: client
        ? {
            ...client,
            created_at: client.created_at.toISOString(),
            updated_at: client.updated_at.toISOString(),
          }
        : null,
      assignedIds: assignmentRows.map((a) => a.user_id),
      members: memberRows.map((m) => ({
        userId: m.user_id,
        role: m.role,
        name:
          profileRows.find((p) => p.id === m.user_id)?.full_name ?? "Unknown",
      })),
      requests: requestRows.map((r) => ({
        ...r,
        created_at: r.created_at.toISOString(),
        fyLabel: fyMap.get(r.financial_year_id) ?? null,
      })),
    };
  });

const toggleAssignmentSchema = z.object({
  clientId: z.number().int().positive(),
  memberId: z.string(),
  assigned: z.boolean(),
  clientName: z.string(),
});

export const toggleAssignment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => toggleAssignmentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const now = new Date();

    if (data.assigned) {
      await db
        .delete(client_assignments)
        .where(
          and(
            eq(client_assignments.client_id, data.clientId),
            eq(client_assignments.user_id, data.memberId)
          )
        );
    } else {
      await db.insert(client_assignments).values({
        tenant_id: tenantId,
        client_id: data.clientId,
        user_id: data.memberId,
        created_at: now,
      });
    }

    await logActivity({ tenantId, userId, action: `${data.assigned ? "Unassigned" : "Assigned"} team member on client ${data.clientName}`, entityType: "client", entityId: String(data.clientId) });

    return { ok: true };
  });

const updateClientSchema = z.object({
  clientId: z.number().int().positive(),
  name: z.string().trim().min(2).max(150),
  pan: z.string().trim().max(10).optional().or(z.literal("")),
  gstin: z.string().trim().max(15).optional().or(z.literal("")),
  mobile: z.string().trim().max(15).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
});

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => updateClientSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const now = new Date();

    await db
      .update(clients)
      .set({
        name: data.name,
        pan: data.pan ? data.pan.toUpperCase() : null,
        gstin: data.gstin ? data.gstin.toUpperCase() : null,
        mobile: data.mobile || null,
        email: data.email || null,
        updated_at: now,
      })
      .where(and(eq(clients.id, data.clientId), eq(clients.tenant_id, tenantId)));

    await logActivity({ tenantId, userId, action: `Updated client ${data.name}`, entityType: "client", entityId: String(data.clientId) });

    return { ok: true };
  });

const deleteClientSchema = z.object({
  clientId: z.number().int().positive(),
  clientName: z.string(),
});

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => deleteClientSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();

    // Verify this client belongs to the tenant
    const [clientRow] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, data.clientId), eq(clients.tenant_id, tenantId)))
      .limit(1);
    if (!clientRow) throw new Error("Client not found");

    // 1. Find all document_requests for this client
    const requests = await db
      .select({ id: document_requests.id })
      .from(document_requests)
      .where(and(eq(document_requests.client_id, data.clientId), eq(document_requests.tenant_id, tenantId)));

    if (requests.length > 0) {
      const requestIds = requests.map((r) => r.id);

      // 2. Find all request_items for these requests
      const items = await db
        .select({ id: request_items.id })
        .from(request_items)
        .where(inArray(request_items.request_id, requestIds));

      if (items.length > 0) {
        const itemIds = items.map((i) => i.id);

        // 3. Find and delete document_files from R2 + DB
        const files = await db
          .select({ id: document_files.id, storage_path: document_files.storage_path })
          .from(document_files)
          .where(inArray(document_files.request_item_id, itemIds));

        if (files.length > 0) {
          const accountId = process.env.R2_ACCOUNT_ID;
          const accessKeyId = process.env.R2_ACCESS_KEY_ID;
          const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
          const bucket = process.env.R2_BUCKET_NAME;

          if (accountId && accessKeyId && secretAccessKey && bucket) {
            const s3 = new S3Client({
              region: "auto",
              endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
              credentials: { accessKeyId, secretAccessKey },
              forcePathStyle: true,
            });
            await Promise.allSettled(
              files.map((f) =>
                s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: f.storage_path }))
              )
            );
          }

          await db.delete(document_files).where(inArray(document_files.request_item_id, itemIds));
        }

        // 4. Delete document_comments
        await db.delete(document_comments).where(inArray(document_comments.request_item_id, itemIds));

        // 5. Delete request_items
        await db.delete(request_items).where(inArray(request_items.request_id, requestIds));
      }

      // 6. Delete document_requests
      await db.delete(document_requests).where(inArray(document_requests.id, requestIds));
    }

    // 7. Delete client_assignments
    await db.delete(client_assignments).where(eq(client_assignments.client_id, data.clientId));

    // 8. Finally delete the client
    await db
      .delete(clients)
      .where(and(eq(clients.id, data.clientId), eq(clients.tenant_id, tenantId)));

    await logActivity({ tenantId, userId, action: `Deleted client ${data.clientName}`, entityType: "client" });

    return { ok: true };
  });
