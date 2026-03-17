import { handleCors, corsResponse } from "./utils/cors.js";
import { getUser } from "./utils/store.js";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export default async function handler(request) {
  const cors = handleCors(request);
  if (cors) return cors;

  if (request.method !== "POST") {
    return corsResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { username } = await request.json();
    if (!username) {
      return corsResponse({ error: "Username required" }, 400);
    }

    const user = await getUser(username.toLowerCase());
    if (!user || !user.forwardTo) {
      // Don't reveal if user exists
      return corsResponse({ success: true, message: "If that account exists, a recovery link was sent." });
    }

    const dashUrl = user.accessKey
      ? `https://email35.com?page=dashboard&user=${user.username}&key=${user.accessKey}`
      : `https://email35.com?page=dashboard`;

    // Send recovery email
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Email35 <noreply@email35.com>",
        to: user.forwardTo,
        subject: "Your Email35 Dashboard Link",
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;background:#0a0a0f;padding:32px;border-radius:12px;color:#e0e0f0;">
            <h2 style="color:#00d4ff;">Your Email35 Dashboard</h2>
            <p>Here's your private dashboard link for <b>${user.username}@email35.com</b>:</p>
            <a href="${dashUrl}" style="display:block;text-align:center;background:#00d4ff;color:#0a0a0f;padding:14px;border-radius:8px;font-weight:700;text-decoration:none;margin:20px 0;">Open Dashboard →</a>
            <p style="color:#666;font-size:.8rem;">Bookmark this link to access your dashboard from any device.</p>
          </div>
        `,
      }),
    });

    return corsResponse({ success: true, message: "If that account exists, a recovery link was sent." });
  } catch (err) {
    console.error("Recover error:", err);
    return corsResponse({ error: "Internal server error" }, 500);
  }
}

export const config = {
  path: "/api/recover",
};
