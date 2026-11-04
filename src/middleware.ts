import { NextResponse, type NextRequest } from "next/server";
import { checkBasicAuth } from "@/app/admin/basic-auth";

/** Basic auth for the admin area; admin server actions check it again (NFR-05). */
export function middleware(req: NextRequest) {
  if (checkBasicAuth(req.headers.get("authorization"))) return NextResponse.next();
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Best in the City admin"' },
  });
}

export const config = { matcher: ["/admin/:path*"] };
