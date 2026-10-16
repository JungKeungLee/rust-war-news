import { NextResponse } from "next/server";
import { publicRoute } from "@/lib/api/handler";
import { destroySession, SESSION_COOKIE } from "@/lib/auth/session";

export const POST = publicRoute(async ({ req }) => {
  await destroySession(req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", expires: new Date(0), sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return res;
});
