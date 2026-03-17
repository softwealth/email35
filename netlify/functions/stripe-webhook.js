import { corsResponse } from "./utils/cors.js";
import {
  getUser,
  getPendingEmailById,
  updatePendingEmail,
  getEmailIndex,
} from "./utils/store.js";
import { forwardEmail } from "./utils/email.js";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// Verify Stripe webhook signature using Web Crypto API (no external deps)
async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!secret) {
    console.warn("STRIPE_WEBHOOK_SECRET not set — skipping verification");
    return true;
  }

  try {
    const elements = {};
    for (const part of sigHeader.split(",")) {
      const [key, value] = part.split("=");
      if (key === "t") elements.t = value;
      if (key === "v1" && !elements.v1) elements.v1 = value;
    }

    if (!elements.t || !elements.v1) return false;

    const signedPayload = `${elements.t}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
    const expectedSig = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Timing-safe comparison (basic)
    if (expectedSig.length !== elements.v1.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expectedSig.length; i++) {
      mismatch |= expectedSig.charCodeAt(i) ^ elements.v1.charCodeAt(i);
    }

    // Also check timestamp is within 5 minutes
    const tolerance = 300;
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(elements.t)) > tolerance) return false;

    return mismatch === 0;
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}

export default async function handler(request) {
  if (request.method !== "POST") {
    return corsResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const rawBody = await request.text();
    const sigHeader = request.headers.get("stripe-signature") || "";

    // Verify webhook signature
    const isValid = await verifyStripeSignature(rawBody, sigHeader, STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
      console.error("Invalid Stripe webhook signature");
      return corsResponse({ error: "Invalid signature" }, 401);
    }

    const event = JSON.parse(rawBody);

    // Handle checkout.session.completed or payment_intent.succeeded
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const emailId = session.metadata?.emailId || session.client_reference_id;

      if (!emailId) {
        console.log("Stripe webhook: no emailId in metadata — ignoring");
        return corsResponse({ received: true });
      }

      // Look up which user this email belongs to
      const index = await getEmailIndex(emailId);
      if (!index) {
        console.error(`Stripe webhook: email index not found for ${emailId}`);
        return corsResponse({ received: true, error: "email not found" });
      }

      const username = index.username;
      const userRecord = await getUser(username);
      if (!userRecord) {
        console.error(`Stripe webhook: user not found for ${username}`);
        return corsResponse({ received: true, error: "user not found" });
      }

      const email = await getPendingEmailById(username, emailId);
      if (!email) {
        console.error(`Stripe webhook: pending email not found ${emailId}`);
        return corsResponse({ received: true, error: "pending email not found" });
      }

      // Mark as paid and forward
      await updatePendingEmail(username, emailId, { status: "paid_delivered", paidAt: new Date().toISOString() });

      const fwd = await forwardEmail({
        to: userRecord.forwardTo,
        originalFrom: email.from,
        subject: email.subject,
        body: email.body,
      });

      console.log(`Payment confirmed for ${emailId} — forwarded to ${userRecord.forwardTo}: ${fwd.success}`);

      return corsResponse({
        received: true,
        emailId,
        forwarded: fwd.success,
      });
    }

    // Handle payment_intent.succeeded (alternative flow)
    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;
      const emailId = intent.metadata?.emailId;

      if (emailId) {
        const index = await getEmailIndex(emailId);
        if (index) {
          const userRecord = await getUser(index.username);
          const email = await getPendingEmailById(index.username, emailId);

          if (userRecord && email) {
            await updatePendingEmail(index.username, emailId, {
              status: "paid_delivered",
              paidAt: new Date().toISOString(),
            });

            await forwardEmail({
              to: userRecord.forwardTo,
              originalFrom: email.from,
              subject: email.subject,
              body: email.body,
            });
          }
        }
      }

      return corsResponse({ received: true });
    }

    // Other event types — acknowledge receipt
    return corsResponse({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return corsResponse({ error: "Webhook processing failed" }, 500);
  }
}

export const config = {
  path: "/api/stripe-webhook",
};
