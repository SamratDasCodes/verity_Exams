"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, generateAdminToken, getAdminPin } from "@/lib/auth";

export interface AuthState {
  success: boolean;
  error?: string;
}

export async function verifyAdminPin(pin: string): Promise<AuthState> {
  const cleanPin = pin ? pin.trim() : "";
  const expectedPin = getAdminPin().trim();

  if (!cleanPin) {
    return { success: false, error: "Please enter the Admin PIN." };
  }

  if (cleanPin !== expectedPin) {
    return { success: false, error: "Invalid PIN code. Access denied." };
  }

  // Set secure HTTP-only cookie
  const cookieStore = cookies();
  const token = generateAdminToken();

  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return { success: true };
}

export async function logoutAdmin(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
  redirect("/");
}
