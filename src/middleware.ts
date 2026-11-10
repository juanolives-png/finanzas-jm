import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Protege /app: sin sesión válida, al login.
export async function middleware(req: NextRequest) {
  const token = req.cookies.get("fjm_session")?.value;
  let ok = false;
  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret-cambiar"));
      ok = true;
    } catch { ok = false; }
  }
  if (!ok) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*"] };
