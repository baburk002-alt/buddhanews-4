import type { Request, Response } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { sdk } from "../_core/sdk";
import { COOKIE_NAME } from "@shared/const";

export function mockReq(overrides: Partial<Record<string, unknown>> = {}): Request {
  const headers = (overrides.headers as Record<string, string>) ?? {};
  return {
    ip: "203.0.113.7",
    protocol: "https",
    headers: { host: "news.example.com", ...headers },
    get(name: string) {
      return headers[name.toLowerCase()];
    },
    ...overrides,
  } as unknown as Request;
}

export function mockRes(): Response {
  const res = {
    clearCookie: () => res,
    cookie: () => res,
    setHeader: () => res,
    status: () => res,
    json: () => res,
    send: () => res,
  };
  return res as unknown as Response;
}

export async function createUser(
  email: string,
  role: "user" | "editor" | "admin",
  options: { name?: string; roleSource?: "default" | "env" | "manual"; openId?: string } = {}
): Promise<User> {
  const openId = options.openId ?? `test-${email}`;
  await db.upsertUser({
    openId,
    email,
    name: options.name ?? email.split("@")[0],
    loginMethod: "test",
  });
  if (role !== "user" || options.roleSource === "manual") {
    await db.setUserRole(
      (await db.getUserByOpenId(openId))!.id,
      role,
      options.roleSource ?? "manual"
    );
  }
  return (await db.getUserByOpenId(openId))!;
}

/** Issue a real session row and return the Cookie header value. */
export async function sessionCookie(user: User): Promise<string> {
  const { token } = await sdk.issueSession(user, mockReq());
  return `${COOKIE_NAME}=${token}`;
}

export async function callerContext(user: User | null, req = mockReq()) {
  return {
    req,
    res: mockRes(),
    user,
    access: null,
    sessionId: undefined,
  };
}
