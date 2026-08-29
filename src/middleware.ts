import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, generateAdminToken } from "./lib/auth";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Protect /dashboard and all subroutes
  if (path.startsWith("/dashboard")) {
    const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME);
    const validToken = generateAdminToken();

    if (!sessionCookie || sessionCookie.value !== validToken) {
      const loginUrl = new URL("/", request.url);
      loginUrl.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/dashboard"],
};
