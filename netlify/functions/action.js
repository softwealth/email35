import { handleCors, corsResponse } from "./utils/cors.js";
import {
  getUser,
  getPendingEmailById,
  updatePendingEmail,
  removePendingEmail,
  addToWhitelist,
  addToBlocklist,
} from "./utils/store.js";
import { forwardEmail } from "./utils/email.js";

export default async function handler(request) {
  // Handle CORS preflight
  const cors = handleCors(request);
  if (cors) return cors;

  if (request.method !== "POST") {
    return corsResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { emailId, action, user } = await request.json();

    // Validate
    if (!emailId || !action || !user) {
      return corsResponse({ error: "emailId, action, and user are required" }, 400);
    }

    if (!["allow", "whitelist", "block"].includes(action)) {
      return corsResponse({ error: "action must be 'allow', 'whitelist', or 'block'" }, 400);
    }

    const username = user.toLowerCase();
    const userRecord = await getUser(username);
    if (!userRecord) {
      return corsResponse({ error: "User not found" }, 404);
    }

    const email = await getPendingEmailById(username, emailId);
    if (!email) {
      return corsResponse({ error: "Email not found" }, 404);
    }

    let result = { success: true, action };

    switch (action) {
      case "allow": {
        // One-time delivery — mark as delivered and forward
        await updatePendingEmail(username, emailId, { status: "delivered" });
        const fwd = await forwardEmail({
          to: userRecord.forwardTo,
          originalFrom: email.from,
          subject: email.subject,
          body: email.body,
        });
        result.forwarded = fwd.success;
        break;
      }

      case "whitelist": {
        // Add sender to whitelist, deliver this email, forward
        await addToWhitelist(username, email.from);
        await updatePendingEmail(username, emailId, { status: "delivered" });
        const fwd = await forwardEmail({
          to: userRecord.forwardTo,
          originalFrom: email.from,
          subject: email.subject,
          body: email.body,
        });
        result.forwarded = fwd.success;
        result.whitelisted = email.from;
        break;
      }

      case "block": {
        // Add sender to blocklist, delete the email
        await addToBlocklist(username, email.from);
        await removePendingEmail(username, emailId);
        result.blocked = email.from;
        break;
      }
    }

    return corsResponse(result);
  } catch (err) {
    console.error("Action error:", err);
    return corsResponse({ error: "Internal server error" }, 500);
  }
}

export const config = {
  path: "/api/action",
};
