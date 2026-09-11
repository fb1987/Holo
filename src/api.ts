import type {
  Project,
  RuntimeStatus,
  ModelOption,
  BuildMode,
  Station,
} from "../shared/types";
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
  connect: () => request<RuntimeStatus>("/runtime/connect", { method: "POST" }),
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
