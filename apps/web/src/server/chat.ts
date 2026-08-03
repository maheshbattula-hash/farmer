import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";
import { redirectWithFlash } from "@/lib/http";
import { renderTemplate } from "@/lib/template";

import { authFailureRedirect, requireSession } from "@/server/session";
import { getString } from "@/server/utils";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function chatPage(request: NextRequest, threadId?: string): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["customer", "farmer"]);
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const [{ response: inboxResponse, data: inboxData }, threadResult] = await Promise.all([
    apiFetch("/api/chat/inbox", { method: "GET" }, sessionOrResponse.token),
    threadId
      ? apiFetch(`/api/chat/thread/${threadId}`, { method: "GET" }, sessionOrResponse.token)
      : Promise.resolve(null),
  ]);

  const authRedirect = authFailureRedirect(request, inboxResponse.status);
  if (authRedirect) {
    return authRedirect;
  }
  if (!inboxResponse.ok || !inboxData.success) {
    return redirectWithFlash(request, "/marketplace", "error", String(inboxData.message || "Unable to load chat inbox"));
  }

  const threads = asArray(inboxData.threads);
  const selectedThreadId = threadId || String((threads[0] as Record<string, unknown>)?.id || "");
  let selectedThread: Record<string, unknown> = {};
  let messages: Array<Record<string, unknown>> = [];

  if (threadResult && threadResult.response.ok && threadResult.data.success) {
    selectedThread = asRecord(threadResult.data.thread);
    messages = asArray(threadResult.data.messages);
  } else if (selectedThreadId) {
    const { response, data } = await apiFetch(`/api/chat/thread/${selectedThreadId}`, { method: "GET" }, sessionOrResponse.token);
    if (response.ok && data.success) {
      selectedThread = asRecord(data.thread);
      messages = asArray(data.messages);
    }
  }

  return renderTemplate(
    request,
    "chat.html",
    {
      threads,
      unread_total: Number(inboxData.unread_total || 0),
      selected_thread_id: selectedThreadId,
      selected_thread: selectedThread,
      messages,
    },
    selectedThreadId ? "chat_thread" : "chat",
  );
}

export async function startChatAction(request: NextRequest, cropId: string): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["customer", "farmer"]);
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const { response, data } = await apiFetch(`/api/chat/start/${cropId}`, { method: "POST" }, sessionOrResponse.token);
  const authRedirect = authFailureRedirect(request, response.status);
  if (authRedirect) {
    return authRedirect;
  }
  if (!response.ok || !data.success || !data.thread) {
    return redirectWithFlash(request, "/marketplace", "error", String(data.message || "Unable to open chat"));
  }

  const thread = asRecord(data.thread);
  return redirectWithFlash(request, `/chat/${String(thread.id || "")}`, "success", String(data.message || "Chat ready"));
}

export async function sendMessageAction(request: NextRequest, threadId: string): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["customer", "farmer"]);
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const formData = await request.formData();
  const { response, data } = await apiFetch(
    `/api/chat/thread/${threadId}/messages`,
    { method: "POST", body: { body: getString(formData, "body") } },
    sessionOrResponse.token,
  );
  const authRedirect = authFailureRedirect(request, response.status);
  if (authRedirect) {
    return authRedirect;
  }

  return redirectWithFlash(
    request,
    `/chat/${threadId}`,
    response.ok && data.success ? "success" : "error",
    String(data.message || (response.ok ? "Message sent" : "Unable to send message")),
  );
}
