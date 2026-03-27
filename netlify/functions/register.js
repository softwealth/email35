import { handleCors, corsResponse } from "./utils/cors.js";
import { getUser, setUser } from "./utils/store.js";

export default async function handler(request) {
  // Handle CORS preflight
  const cors = handleCors(request);
  if (cors) return cors;

  if (request.method !== "POST") {
    return corsResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { username, forwardTo, walletAddress, price } = await request.json();

    // Validate required fields
    if (!username || !forwardTo) {
      return corsResponse({ error: "username and forwardTo are required" }, 400);
    }

    // Validate username format (alphanumeric, dots, hyphens, underscores)
    const usernameClean = username.toLowerCase().trim();
    if (!/^[a-z0-9._-]{1,64}$/.test(usernameClean)) {
      return corsResponse({
        error: "Invalid username. Use lowercase letters, numbers, dots, hyphens, underscores (max 64 chars)",
      }, 400);
    }

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forwardTo)) {
      return corsResponse({ error: "Invalid forwardTo email address" }, 400);
    }

    // Check if username already taken
    const existing = await getUser(usernameClean);
    if (existing) {
      return corsResponse({ error: "Username already taken" }, 409);
    }

    // Generate access key for dashboard login
    const accessKey = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);

    // Create user record
    const user = await setUser(usernameClean, {
      forwardTo,
      walletAddress: walletAddress || "0xDf2FD1fBA88BCC38Edee237a069A880FD4997Bc3",
      price: price || 0.5,
      accessKey,
    });

    return corsResponse({
      success: true,
      email: `${usernameClean}@email35.com`,
      accessKey,
      dashboardUrl: `https://email35.com?page=dashboard&user=${usernameClean}&key=${accessKey}`,
      user: {
        username: user.username,
        forwardTo: user.forwardTo,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    return corsResponse({ error: "Internal server error" }, 500);
  }
}

export const config = {
  path: "/api/register",
};
