import { handleCors, corsResponse } from "./utils/cors.js";
import { getUser, setUser } from "./utils/store.js";

export default async function handler(request) {
  const cors = handleCors(request);
  if (cors) return cors;

  if (request.method !== "POST") {
    return corsResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { username, key, walletAddress, forwardTo, price } = await request.json();

    if (!username || !key) {
      return corsResponse({ error: "username and key are required" }, 400);
    }

    const user = await getUser(username);
    if (!user) {
      return corsResponse({ error: "User not found" }, 404);
    }

    // Verify access key
    if (user.accessKey && key !== user.accessKey) {
      return corsResponse({ error: "Invalid access key" }, 403);
    }

    // Update fields that were provided
    const updates = {};
    if (walletAddress !== undefined) updates.walletAddress = walletAddress;
    if (forwardTo !== undefined) updates.forwardTo = forwardTo;
    if (price !== undefined) updates.price = price;

    await setUser(username, { ...updates });

    return corsResponse({
      success: true,
      updated: Object.keys(updates),
    });
  } catch (err) {
    console.error("Settings error:", err);
    return corsResponse({ error: "Internal server error" }, 500);
  }
}

export const config = {
  path: "/api/settings",
};
