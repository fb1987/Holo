import type {
  Project,
  RuntimeStatus,
  ModelOption,
  BuildMode,
  Station,
  StudioPreferences,
} from "../shared/types";
import type { WorkshopStatus } from "../server/build/broker";
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init?.body || init?.method === "POST"
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let detail: string;
    try {
      const body = await response.json();
      detail = body.error || body.message || response.statusText;
    } catch {
      detail = response.statusText;
    }
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
export const api = {
  workshop: () => request<WorkshopStatus>("/workshop"),
  checkWorkshop: () =>
    request<WorkshopStatus>("/workshop/check", { method: "POST" }),
  setWorkshopEnabled: (enabled: boolean) =>
    request<WorkshopStatus>("/workshop", {
      method: "POST",
      body: JSON.stringify({ enabled }),
    }),
  preferences: () => request<StudioPreferences>("/preferences"),
  savePreferences: (preferences: StudioPreferences) =>
    request("/preferences", {
      method: "POST",
      body: JSON.stringify(preferences),
      keepalive: true,
    }),
  projects: () => request<Project[]>("/projects"),
  create: (
    template: "blank" | "wheel" | "enclosure",
    buildMode: BuildMode = "mixed",
  ) =>
    request<Project>("/projects", {
      method: "POST",
      body: JSON.stringify({ template, buildMode }),
    }),
  update: (id: string, patch: Partial<Project>) =>
    request<Project>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  runtime: () => request<RuntimeStatus>("/runtime"),
  connect: (refreshTools = true) =>
    request<RuntimeStatus>("/runtime/connect", {
      method: "POST",
      body: JSON.stringify({ refreshTools }),
    }),
  models: () => request<ModelOption[]>("/models"),
  login: () =>
    request<{ authUrl?: string }>("/runtime/login", { method: "POST" }),
  send: (
    id: string,
    text: string,
    station: Station,
    model?: string,
    effort?: string,
  ) =>
    request<{ jobId: string }>(`/projects/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        text,
        station,
        model: model || undefined,
        effort,
      }),
    }),
  cancel: (id: string) => request(`/projects/${id}/cancel`, { method: "POST" }),
  approve: (id: string, decision: "accept" | "decline") =>
    request(`/approvals/${id}`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    }),
  fileUrl: (id: string, path: string) =>
    `/api/projects/${id}/files?path=${encodeURIComponent(path)}`,
};
