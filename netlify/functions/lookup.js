import { handleCors, corsResponse } from "./utils/cors.js";
import { getEmailIndex, getPendingEmailById, getUser } from "./utils/store.js";

export default async function handler(request) {
  // Handle CORS preflight
  const cors = handleCors(request);
  if (cors) return cors;

  if (request.method !== "GET") {
    return corsResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const url = new URL(request.url);
    const emailId = url.searchParams.get("id");

    if (!emailId) {
      return corsResponse({ error: "Missing ?id= query parameter" }, 400);
    }

    const index = await getEmailIndex(emailId);
    if (!index) {
      return corsResponse({ error: "Email not found" }, 404);
    }

    const email = await getPendingEmailById(index.username, emailId);
    if (!email) {
      return corsResponse({ error: "Email not found" }, 404);
    }

    const user = await getUser(index.username);

    return corsResponse({
      success: true,
      emailId: email.id,
      from: email.from,
      to: email.to,
      subject: email.subject,
      status: email.status,
      createdAt: email.createdAt,
      recipient: index.username,
      walletAddress: user?.walletAddress || "0xDf2FD1fBA88BCC38Edee237a069A880FD4997Bc3",
      cryptoPrice: "10000",  // 0.01 USDC (6 decimals)
      cardPrice: 0.50,
    });
  } catch (err) {
    console.error("Lookup error:", err);
    return corsResponse({ error: "Internal server error" }, 500);
  }
}

export const config = {
  path: "/api/lookup",
};
