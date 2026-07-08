// Cookie-based admin auth for the campaign panel. The session cookie carries
// an HMAC derived from ADMIN_PASSWORD, so rotating the password invalidates
// every session. Simple by design: one admin, short-lived campaign.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE = "mundial_admin";

const expectedToken = () => {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return createHmac("sha256", password).update("mundial-admin-v1").digest("hex");
};

export const adminConfigured = () => Boolean(process.env.ADMIN_PASSWORD);

export const passwordMatches = (candidate: string) => {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(password);
  return a.length === b.length && timingSafeEqual(a, b);
};

export const sessionToken = () => expectedToken();

export const isAdminRequest = (req: NextRequest): boolean => {
  const expected = expectedToken();
  if (!expected) return false;
  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!cookie || cookie.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(cookie), Buffer.from(expected));
};
