import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { checkBasicAuth } from "./basic-auth";

/**
 * Server actions can be called through any route, not only /admin, so every admin
 * action checks the credentials itself instead of relying on the middleware alone.
 * Returns the actor recorded in the audit log.
 */
export async function requireAdmin(): Promise<string> {
  if (!checkBasicAuth((await headers()).get("authorization"))) throw new Error("Admin sign-in required");
  return process.env.ADMIN_USER ?? "admin";
}

type Json = Prisma.InputJsonValue | undefined;

/** FR-ADM-02: who changed what, with the state before and after. */
export function auditEntry(actor: string, action: string, target: string, before?: Json, after?: Json): Prisma.AuditLogCreateInput {
  return { actor, action, target, before, after };
}

export function audit(actor: string, action: string, target: string, before?: Json, after?: Json) {
  return db.auditLog.create({ data: auditEntry(actor, action, target, before, after) });
}
