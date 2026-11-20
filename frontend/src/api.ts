import axios from "axios";
import type { ApiError } from "../../shared/contracts";

export const api = axios.create({ baseURL: "/api", withCredentials: true });
let csrf = "";
let sessionVersion = 0;
let onUnauthorized: (() => void) | undefined;
const requestVersions = new WeakMap<object, number>();
export function onSessionExpired(handler: () => void) {
  onUnauthorized = handler;
  return () => {
    if (onUnauthorized === handler) onUnauthorized = undefined;
  };
}
export function isUnauthorized(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401;
}
export function setCsrf(value: string) {
  if (csrf !== value) sessionVersion++;
  csrf = value;
}
api.interceptors.request.use((config) => {
  requestVersions.set(config, sessionVersion);
  if (
    config.method &&
    !["get", "head", "options"].includes(config.method.toLowerCase())
  ) {
    if (csrf) config.headers.set("X-CSRF-Token", csrf);
    if (!config.headers.has("Idempotency-Key"))
      config.headers.set("Idempotency-Key", crypto.randomUUID());
  }
  return config;
});
api.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    const config = error.config;
    const url = config?.url?.split("?")[0];
    if (
      config &&
      requestVersions.get(config) === sessionVersion &&
      !["/auth/login", "/auth/register", "/users/me"].includes(url || "")
    )
      onUnauthorized?.();
  }
  return Promise.reject(error);
});
export async function get<T>(url: string): Promise<T> {
  return (await api.get<{ data: T }>(url)).data.data;
}
export async function write<T>(
  method: "post" | "patch",
  url: string,
  body?: unknown,
  key?: string,
): Promise<T> {
  return (
    await api.request<{ data: T }>({
      method,
      url,
      data: body,
      headers: key ? { "Idempotency-Key": key } : undefined,
    })
  ).data.data;
}
export function errorText(error: unknown): string {
  if (axios.isAxiosError<ApiError>(error))
    return (
      error.response?.data?.error?.message ||
      "Không thể kết nối. Vui lòng thử lại."
    );
  return "Đã có lỗi xảy ra. Vui lòng thử lại.";
}
