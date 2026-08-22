import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth-middleware";
import { eq, desc } from "drizzle-orm";
import crypto from "node:crypto";

const AMC_AMOUNT_INR = 5999;
const AMC_AMOUNT_PAISE = AMC_AMOUNT_INR * 100;

async function getRazorpayInstance() {
  const { default: Razorpay } = await import("razorpay");
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay keys not configured.");
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function endOfYear(year: number) {
  return new Date(`${year}-12-31T23:59:59.000`);
}

// ── Get current AMC status ────────────────────────────────────────────────────
export const getAmcStatus = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const { getDb } = await import("@/lib/db");
    const { amc_payments } = await import("@/lib/db/schema");
    const db = getDb();

    const [latest] = await db
      .select()
      .from(amc_payments)
      .where(eq(amc_payments.status, "completed"))
      .orderBy(desc(amc_payments.valid_until))
      .limit(1);

    const now = new Date();
    const currentYear = now.getFullYear();
    const active = latest ? new Date(latest.valid_until) > now : false;

    return {
      active,
      amountInr: AMC_AMOUNT_INR,
      latestValidUntil: latest?.valid_until ?? null,
      year: currentYear,
    };
  });

// ── Create Razorpay order ─────────────────────────────────────────────────────
export const createAmcOrder = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { getDb } = await import("@/lib/db");
    const { amc_payments } = await import("@/lib/db/schema");
    const db = getDb();
    const userId = Number(context.userId);
    const now = new Date();
    const year = now.getFullYear();

    const razorpay = await getRazorpayInstance();

    const order = await razorpay.orders.create({
      amount: AMC_AMOUNT_PAISE,
      currency: "INR",
      receipt: `amc-${year}-${Date.now()}`,
      notes: {
        purpose: "Yearly AMC",
        year: String(year),
        userId: String(userId),
      },
    });

    await db.insert(amc_payments).values({
      amount_paise: AMC_AMOUNT_PAISE,
      razorpay_order_id: order.id,
      status: "pending",
      year,
      valid_until: endOfYear(year),
      paid_by: userId,
      created_at: now,
      updated_at: now,
    });

    return {
      orderId: order.id,
      keyId: process.env.RAZORPAY_KEY_ID!,
      amount: AMC_AMOUNT_PAISE,
      currency: "INR",
      name: "Cremation Center",
      description: `Yearly maintenance ${year}`,
    };
  });

// ── Verify and confirm Razorpay payment ───────────────────────────────────────
export const verifyAmcPayment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    (d: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => d
  )
  .handler(async ({ data }) => {
    const { getDb } = await import("@/lib/db");
    const { amc_payments } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();

    const secret = process.env.RAZORPAY_KEY_SECRET!;
    const body = `${data.razorpay_order_id}|${data.razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (expected !== data.razorpay_signature) {
      throw new Error("Payment verification failed.");
    }

    const now = new Date();

    const [updated] = await db
      .update(amc_payments)
      .set({
        status: "completed",
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_signature: data.razorpay_signature,
        paid_at: now,
        updated_at: now,
      })
      .where(eq(amc_payments.razorpay_order_id, data.razorpay_order_id));

    return { success: true, validUntil: updated ? (updated as any).valid_until : null };
  });

// ── Poll Razorpay order for captured payment (fallback for test mode UI issues) ─
export const pollAmcOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: { orderId: string }) => d)
  .handler(async ({ data }) => {
    const { getDb } = await import("@/lib/db");
    const { amc_payments } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();

    const razorpay = await getRazorpayInstance();

    let payments: any[] = [];
    try {
      const res = await razorpay.orders.fetchPayments(data.orderId);
      payments = res.items ?? [];
    } catch {
      return { success: false, paid: false };
    }

    const captured = payments.find(
      (p: any) => p.status === "captured" && p.captured === true
    );

    if (!captured) {
      return { success: true, paid: false };
    }

    const now = new Date();
    await db
      .update(amc_payments)
      .set({
        status: "completed",
        razorpay_payment_id: captured.id,
        paid_at: now,
        updated_at: now,
      })
      .where(eq(amc_payments.razorpay_order_id, data.orderId));

    return { success: true, paid: true };
  });
