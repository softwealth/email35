import { handleCors, corsResponse } from "./utils/cors.js";
import { getUser, getPendingEmails } from "./utils/store.js";

export default async function handler(request) {
  // Handle CORS preflight
  const cors = handleCors(request);
  if (cors) return cors;

  if (request.method !== "GET") {
    return corsResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const url = new URL(request.url);
    const username = url.searchParams.get("user");

    if (!username) {
      return corsResponse({ error: "Missing ?user= query parameter" }, 400);
    }

    const user = await getUser(username);
    if (!user) {
      return corsResponse({ error: "User not found" }, 404);
    }

    const emails = await getPendingEmails(username);

    // Only return pending (non-delivered) emails, strip body for listing
    const pending = emails
      .filter((e) => e.status === "pending")
      .map((e) => ({
        id: e.id,
        from: e.from,
        subject: e.subject,
        status: e.status,
        createdAt: e.createdAt,
      }));

    return corsResponse({
      success: true,
      user: username.toLowerCase(),
      count: pending.length,
      emails: pending,
    });
  } catch (err) {
    console.error("Pending error:", err);
    return corsResponse({ error: "Internal server error" }, 500);
  }
}

export const config = {
  path: "/api/pending",
};
