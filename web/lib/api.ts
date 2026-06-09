"use client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
const STORAGE_KEY = "opspilot_token";

let cachedToken: string | null = null;

export async function fetcher<T>(path: string): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (res.status === 401) {
    clearAuthToken();
    throw new AuthError(await res.text());
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const token = await authToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(await res.text());
  const payload = await res.json();
  if (payload && typeof payload === "object" && "token" in payload && typeof payload.token === "string") {
    cachedToken = payload.token;
  }
  return payload;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const token = await authToken();
  const res = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const token = await authToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function authToken() {
  if (cachedToken) return cachedToken;
  cachedToken = getStoredToken();
  if (!cachedToken) throw new AuthError("login required");
  return cachedToken;
}

export class AuthError extends Error {
  name = "AuthError";
}

export function getStoredToken() {
  if (cachedToken) return cachedToken;
  if (typeof window === "undefined") return null;
  cachedToken = window.localStorage.getItem(STORAGE_KEY);
  return cachedToken;
}

export function setAuthToken(token: string) {
  cachedToken = token;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, token);
  }
}

export function clearAuthToken() {
  cachedToken = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export async function login(username: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new AuthError(await res.text());
  const payload = await res.json();
  if (payload?.token && typeof payload.token === "string") {
    setAuthToken(payload.token);
  }
  return payload as { ok: boolean; token: string };
}

export { API_BASE };
