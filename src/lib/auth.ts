import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "quiz_admin_session";
const FALLBACK_PIN = "2026";
const FALLBACK_SECRET = "quiz-admin-secure-secret-token-key";

export function getAdminPin(): string {
  return process.env.ADMIN_PIN || FALLBACK_PIN;
}

export function getAdminSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || FALLBACK_SECRET;
}

// Generate an authentication token based on secret
export function generateAdminToken(): string {
  const secret = getAdminSecret();
  const payload = `quiz_admin_auth_${secret}`;
  // Simple, robust base64 encoding that works across Edge & Node
  if (typeof Buffer !== "undefined") {
    return Buffer.from(payload).toString("base64");
  }
  return btoa(payload);
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const expectedToken = generateAdminToken();
  return token === expectedToken;
}

// Check admin authentication from server actions / server components
export async function isAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME);
    return verifyAdminToken(sessionCookie?.value);
  } catch {
    // Outside request context (e.g. CLI or integration test scripts)
    return process.env.NODE_ENV === "test" || process.env.CLI_TEST === "true";
  }
}
