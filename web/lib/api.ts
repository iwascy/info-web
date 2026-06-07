"use client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
const ENV_TOKEN = process.env.NEXT_PUBLIC_INGEST_TOKEN;

let cachedToken: string | null = ENV_TOKEN || null;

export async function fetcher<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
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
  const settings = await fetcher<Record<string, string>>("/api/settings");
  cachedToken = settings.token || "opspilot-dev-token";
  return cachedToken;
}

export { API_BASE };
