import { getStore } from "@netlify/blobs";

// --- Store references ---
function usersStore() {
  return getStore({ name: "users", consistency: "strong" });
}

function pendingStore() {
  return getStore({ name: "pending-emails", consistency: "strong" });
}

function whitelistStore() {
  return getStore({ name: "whitelists", consistency: "strong" });
}

function blocklistStore() {
  return getStore({ name: "blocklists", consistency: "strong" });
}

// --- User operations ---

export async function getUser(username) {
  const store = usersStore();
  const data = await store.get(username.toLowerCase(), { type: "json" });
  return data || null;
}

export async function setUser(username, userData) {
  const store = usersStore();
  const key = username.toLowerCase();
  // Merge with existing data to preserve fields like accessKey
  const existing = (await store.get(key, { type: "json" })) || {};
  const record = {
    ...existing,
    username: key,
    ...userData,
    createdAt: existing.createdAt || userData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await store.setJSON(key, record);
  return record;
}

export async function listAllUsers() {
  const store = usersStore();
  const { blobs } = await store.list();
  const users = [];
  for (const blob of blobs) {
    const user = await store.get(blob.key, { type: "json" });
    if (user) users.push(user);
  }
  return users;
}

// --- Pending email operations ---

export async function getPendingEmails(username) {
  const store = pendingStore();
  const key = username.toLowerCase();
  const data = await store.get(key, { type: "json" });
  return data || [];
}

export async function addPendingEmail(username, emailData) {
  const store = pendingStore();
  const key = username.toLowerCase();
  const existing = (await store.get(key, { type: "json" })) || [];
  const emailRecord = {
    id: emailData.id,
    from: emailData.from,
    to: emailData.to,
    subject: emailData.subject,
    body: emailData.body,
    headers: emailData.headers || {},
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  existing.push(emailRecord);
  await store.setJSON(key, existing);
  return emailRecord;
}

export async function getPendingEmailById(username, emailId) {
  const emails = await getPendingEmails(username);
  return emails.find((e) => e.id === emailId) || null;
}

export async function updatePendingEmail(username, emailId, updates) {
  const store = pendingStore();
  const key = username.toLowerCase();
  const emails = (await store.get(key, { type: "json" })) || [];
  const idx = emails.findIndex((e) => e.id === emailId);
  if (idx === -1) return null;
  emails[idx] = { ...emails[idx], ...updates, updatedAt: new Date().toISOString() };
  await store.setJSON(key, emails);
  return emails[idx];
}

export async function removePendingEmail(username, emailId) {
  const store = pendingStore();
  const key = username.toLowerCase();
  const emails = (await store.get(key, { type: "json" })) || [];
  const filtered = emails.filter((e) => e.id !== emailId);
  await store.setJSON(key, filtered);
  return filtered;
}

// --- Whitelist operations ---

export async function getWhitelist(username) {
  const store = whitelistStore();
  const key = username.toLowerCase();
  const data = await store.get(key, { type: "json" });
  return data || [];
}

export async function isWhitelisted(username, senderEmail) {
  const list = await getWhitelist(username);
  const sender = senderEmail.toLowerCase();
  return list.some((entry) => sender === entry.toLowerCase() || sender.endsWith("@" + entry.toLowerCase()));
}

export async function addToWhitelist(username, senderEmail) {
  const store = whitelistStore();
  const key = username.toLowerCase();
  const list = (await store.get(key, { type: "json" })) || [];
  const email = senderEmail.toLowerCase();
  if (!list.includes(email)) {
    list.push(email);
    await store.setJSON(key, list);
  }
  return list;
}

// --- Blocklist operations ---

export async function getBlocklist(username) {
  const store = blocklistStore();
  const key = username.toLowerCase();
  const data = await store.get(key, { type: "json" });
  return data || [];
}

export async function isBlocked(username, senderEmail) {
  const list = await getBlocklist(username);
  const sender = senderEmail.toLowerCase();
  return list.some((entry) => sender === entry.toLowerCase() || sender.endsWith("@" + entry.toLowerCase()));
}

export async function addToBlocklist(username, senderEmail) {
  const store = blocklistStore();
  const key = username.toLowerCase();
  const list = (await store.get(key, { type: "json" })) || [];
  const email = senderEmail.toLowerCase();
  if (!list.includes(email)) {
    list.push(email);
    await store.setJSON(key, list);
  }
  return list;
}

// --- Email-to-user index (for lookups by emailId across all users) ---

function emailIndexStore() {
  return getStore({ name: "email-index", consistency: "strong" });
}

export async function setEmailIndex(emailId, username) {
  const store = emailIndexStore();
  await store.setJSON(emailId, { username: username.toLowerCase(), emailId });
}

export async function getEmailIndex(emailId) {
  const store = emailIndexStore();
  const data = await store.get(emailId, { type: "json" });
  return data || null;
}
