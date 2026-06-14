import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth");

  // Always allow auth routes and login page through
  if (isAuthRoute || isLoginPage) {
    return NextResponse.next();
  }

  // Redirect to login if not authenticated
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

// Tell Next.js which routes the middleware runs on
// This pattern matches everything except static files and images
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
