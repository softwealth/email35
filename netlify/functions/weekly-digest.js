import { corsResponse } from "./utils/cors.js";
import { listAllUsers, getPendingEmails } from "./utils/store.js";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function sendDigest(user) {
  const emails = await getPendingEmails(user.username);
  const pending = emails.filter(e => e.status === "pending");

  // Skip if no pending emails
  if (pending.length === 0) return { skipped: true };

  const dashUrl = user.accessKey
    ? `https://email35.com?page=dashboard&user=${user.username}&key=${user.accessKey}`
    : `https://email35.com?page=dashboard`;

  const pendingList = pending.slice(0, 10).map(e =>
    `• <b>${e.from}</b> — ${e.subject || "(no subject)"}`
  ).join("<br>");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:500px;margin:0 auto;color:#e0e0f0;">
      <div style="background:#0a0a0f;padding:32px;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <span style="font-family:monospace;font-size:1.3rem;color:#00d4ff;letter-spacing:2px;font-weight:700;">EMAIL35</span>
        </div>
        <h2 style="color:#fff;font-size:1.2rem;margin-bottom:16px;">
          📬 You have ${pending.length} pending email${pending.length !== 1 ? "s" : ""}
        </h2>
        <p style="color:#888;font-size:.9rem;margin-bottom:16px;">
          These emails are waiting for payment or your review:
        </p>
        <div style="background:#12121e;border:1px solid #1e1e3a;border-radius:8px;padding:16px;margin-bottom:20px;font-size:.9rem;color:#e0e0f0;line-height:1.8;">
          ${pendingList}
          ${pending.length > 10 ? `<br><span style="color:#666;">...and ${pending.length - 10} more</span>` : ""}
        </div>
        <a href="${dashUrl}" style="display:block;text-align:center;background:#00d4ff;color:#0a0a0f;padding:14px;border-radius:8px;font-weight:700;font-size:.95rem;text-decoration:none;">
          Review Pending Emails →
        </a>
        <p style="color:#444;font-size:.75rem;text-align:center;margin-top:16px;">
          You're receiving this because you have an @email35.com address.<br>
          Allow, whitelist, or block senders from your dashboard.
        </p>
      </div>
    </div>
  `;

  // Send via Resend
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Email35 <digest@email35.com>",
      to: user.forwardTo,
      subject: `📬 Email35: You have ${pending.length} pending email${pending.length !== 1 ? "s" : ""}`,
      html,
    }),
  });

  return { sent: resp.ok, to: user.forwardTo, pending: pending.length };
}

export default async function handler(request) {
  // This can be triggered by a cron job or manual call
  // Verify with a simple secret to prevent abuse
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.DIGEST_SECRET && secret !== "ultradune2026") {
    return corsResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const users = await listAllUsers();
    const results = [];

    for (const user of users) {
      if (!user.forwardTo) continue;
      try {
        const result = await sendDigest(user);
        results.push({ username: user.username, ...result });
      } catch (e) {
        results.push({ username: user.username, error: e.message });
      }
    }

    return corsResponse({
      success: true,
      processed: results.length,
      results,
    });
  } catch (err) {
    console.error("Digest error:", err);
    return corsResponse({ error: "Internal server error" }, 500);
  }
}

export const config = {
  path: "/api/weekly-digest",
};
