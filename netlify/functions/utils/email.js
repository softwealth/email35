// Email sending utility using Resend API
// Set RESEND_API_KEY in Netlify environment variables

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "noreply@email35.com";

export async function sendEmail({ to, subject, text, html }) {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not set — skipping email send");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Email35 <${FROM_EMAIL}>`,
        to: [to],
        subject,
        text,
        html: html || undefined,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Resend API error:", data);
      return { success: false, error: data };
    }
    return { success: true, id: data.id };
  } catch (err) {
    console.error("Email send failed:", err);
    return { success: false, error: err.message };
  }
}

export async function sendAutoReply({ senderEmail, username, subject, emailId }) {
  const payLink = `https://email35.com?page=pay&id=${emailId}`;
  const text = `Your email "${subject}" is waiting for delivery.
${username} uses Email35 to keep their inbox spam-free.

Pay $0.01 (crypto) or $0.50 (card) to deliver:
${payLink}

This is a one-time payment. If you know ${username}, ask them to whitelist you for free delivery.`;

  const html = `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
<p>Your email <strong>"${escapeHtml(subject)}"</strong> is waiting for delivery.</p>
<p><strong>${escapeHtml(username)}</strong> uses <a href="https://email35.com">Email35</a> to keep their inbox spam-free.</p>
<p>Pay <strong>$0.01</strong> (crypto) or <strong>$0.50</strong> (card) to deliver:</p>
<p><a href="${payLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Pay to Deliver →</a></p>
<p style="color:#666;font-size:13px;">This is a one-time payment. If you know ${escapeHtml(username)}, ask them to whitelist you for free delivery.</p>
</div>`;

  return sendEmail({
    to: senderEmail,
    subject: `Your email to ${username}@email35.com is waiting`,
    text,
    html,
  });
}

export async function forwardEmail({ to, originalFrom, subject, body }) {
  const text = `--- Forwarded via Email35 ---
From: ${originalFrom}
Subject: ${subject}

${body}`;

  const html = `<div style="font-family: sans-serif;">
<p style="color:#666;font-size:12px;border-bottom:1px solid #eee;padding-bottom:8px;">
  Forwarded via Email35 — From: ${escapeHtml(originalFrom)}
</p>
<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
<div>${body}</div>
</div>`;

  return sendEmail({
    to,
    subject: `[Email35] ${subject}`,
    text,
    html,
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
