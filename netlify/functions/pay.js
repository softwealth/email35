import { handleCors, corsResponse } from "./utils/cors.js";
import { getEmailIndex, getPendingEmailById, getUser } from "./utils/store.js";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE_ID = "price_1TC0F8BHohnxbUTEZQlrEE1r";

export default async function handler(request) {
  // Handle CORS preflight
  const cors = handleCors(request);
  if (cors) return cors;

  if (request.method !== "POST") {
    return corsResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { emailId } = await request.json();

    if (!emailId) {
      return corsResponse({ error: "emailId is required" }, 400);
    }

    // Look up the email
    const index = await getEmailIndex(emailId);
    if (!index) {
      return corsResponse({ error: "Email not found" }, 404);
    }

    const email = await getPendingEmailById(index.username, emailId);
    if (!email || email.status !== "pending") {
      return corsResponse({ error: "Email not found or already processed" }, 404);
    }

    const user = await getUser(index.username);

    // Create Stripe Checkout session
    if (!STRIPE_SECRET_KEY) {
      return corsResponse({ error: "Payment service not configured" }, 503);
    }

    const params = new URLSearchParams({
      "mode": "payment",
      "success_url": `https://email35.com?page=pay&id=${emailId}&status=success`,
      "cancel_url": `https://email35.com?page=pay&id=${emailId}&status=cancel`,
      "line_items[0][price]": STRIPE_PRICE_ID,
      "line_items[0][quantity]": "1",
      "metadata[emailId]": emailId,
      "metadata[username]": index.username,
      "client_reference_id": emailId,
    });

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      console.error("Stripe error:", session);
      return corsResponse({ error: "Failed to create payment session" }, 500);
    }

    return corsResponse({
      success: true,
      checkoutUrl: session.url,
      emailId,
      recipient: `${index.username}@email35.com`,
      subject: email.subject,
    });
  } catch (err) {
    console.error("Pay error:", err);
    return corsResponse({ error: "Internal server error" }, 500);
  }
}

export const config = {
  path: "/api/pay",
};
