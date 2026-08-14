import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const sessionToken =
    request.cookies.get("authjs.session-token") ||
    request.cookies.get("__Secure-authjs.session-token");

  const { pathname } = request.nextUrl;
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isPublicApi = pathname.startsWith("/api/auth") || pathname.startsWith("/api/register");

  if (isPublicApi) return NextResponse.next();
  if (!sessionToken && !isAuthPage)
    return NextResponse.redirect(new URL("/login", request.url));
  if (sessionToken && isAuthPage)
    return NextResponse.redirect(new URL("/", request.url));

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
