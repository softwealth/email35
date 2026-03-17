import { handleCors, corsResponse } from "./utils/cors.js";
import {
  getUser,
  addPendingEmail,
  isWhitelisted,
  isBlocked,
  setEmailIndex,
} from "./utils/store.js";
import { sendAutoReply, forwardEmail } from "./utils/email.js";

// Generate a unique email ID
function generateEmailId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `em_${ts}_${rand}`;
}

// Extract username from email address like "username@email35.com"
function extractUsername(toAddress) {
  const match = toAddress.match(/^([^@]+)@email35\.com$/i);
  return match ? match[1].toLowerCase() : null;
}

// Parse sender email — handles "Name <email>" format
function parseSenderEmail(from) {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : from.toLowerCase().trim();
}

export default async function handler(request) {
  // Handle CORS preflight
  const cors = handleCors(request);
  if (cors) return cors;

  if (request.method !== "POST") {
    return corsResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await request.json();

    // Resend webhook wraps data in { type, created_at, data: { ... } }
    const emailData = body.data || body;

    // Support multiple webhook formats (Resend, SendGrid, generic)
    // Resend format: data.from, data.to, data.subject, data.text, data.html
    const rawFrom = emailData.from || emailData.envelope?.from || emailData.sender || "";
    const rawTo = emailData.to || emailData.envelope?.to?.[0] || emailData.recipient || "";
    const from = typeof rawFrom === "object" ? rawFrom.email || rawFrom.address || "" : rawFrom;
    const to = typeof rawTo === "object" ? rawTo.email || rawTo.address || "" : (Array.isArray(rawTo) ? (rawTo[0]?.email || rawTo[0] || "") : rawTo);
    const subject = emailData.subject || "(no subject)";
    const emailBody = emailData.text || emailData.body || emailData.html || "";
    const headers = emailData.headers || {};

    if (!from || !to) {
      return corsResponse({ error: "Missing from/to fields" }, 400);
    }

    const senderEmail = parseSenderEmail(from);
    const username = extractUsername(typeof to === "string" ? to : to[0] || to);

    if (!username) {
      return corsResponse({ error: "Invalid recipient address" }, 400);
    }

    // Look up user
    const user = await getUser(username);
    if (!user) {
      // No such user — silently discard to avoid info leak
      console.log(`Inbound email for unknown user: ${username}`);
      return corsResponse({ success: true, action: "discarded", reason: "unknown_user" });
    }

    // Check whitelist — forward immediately
    if (await isWhitelisted(username, senderEmail)) {
      console.log(`Whitelisted sender ${senderEmail} → forwarding to ${user.forwardTo}`);
      const fwd = await forwardEmail({
        to: user.forwardTo,
        originalFrom: senderEmail,
        subject,
        body: emailBody,
      });
      return corsResponse({ success: true, action: "forwarded", forwarded: fwd.success });
    }

    // Check blocklist — discard
    if (await isBlocked(username, senderEmail)) {
      console.log(`Blocked sender ${senderEmail} — discarding`);
      return corsResponse({ success: true, action: "blocked" });
    }

    // Store as pending
    const emailId = generateEmailId();
    await addPendingEmail(username, {
      id: emailId,
      from: senderEmail,
      to: `${username}@email35.com`,
      subject,
      body: emailBody,
      headers,
    });

    // Index email for lookup by ID (used by payment webhook)
    await setEmailIndex(emailId, username);

    // Send auto-reply to sender with payment link
    const reply = await sendAutoReply({
      senderEmail,
      username,
      subject,
      emailId,
    });

    console.log(`Pending email ${emailId} from ${senderEmail} to ${username} — auto-reply: ${reply.success}`);

    return corsResponse({
      success: true,
      action: "pending",
      emailId,
      autoReplySent: reply.success,
    });
  } catch (err) {
    console.error("Inbound error:", err);
    return corsResponse({ error: "Internal server error" }, 500);
  }
}

export const config = {
  path: "/api/inbound",
};
