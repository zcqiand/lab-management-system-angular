// 把 ?from= / redirect= 等 query 兜底成 lab 内部绝对路径。
// 移植自 lab-management-system-react/src/lib/sanitize-redirect.ts（REQ-2026-031，1:1）。
//
// 防御 saas post-login 把字面量字符串 "undefined" 当 redirect 路径
// （历史上 saas 拼 URL 模板时 `${redirect}` 渲染成 "undefined"，
// lab 收到 `http://localhost:5202/undefined` 路由 404）。
//
// 规则：
//   - null / undefined / 空串 → "/"
//   - 整串是字面量 "undefined" / "null" → "/"
//   - 非 "/" 开头的相对路径（避免 saas 把 redirect 拼成外部 URL）→ "/"
//   - 含 "//" 的（协议相对 URL //evil.com）→ "/"
//   - 任意 path 段是字面量 "undefined" / "null" / "NaN" / "false" / "true"
//     （saas 模板插值产生的 /undefined/data-entry 形式）→ "/"
//   - 通过校验：原样返回（登录成功后回跳）

const BAD_PATH_SEGMENTS = new Set(["undefined", "null", "NaN", "false", "true"]);

export function sanitizeRedirect(from: string | null | undefined): string {
  if (!from) return "/";
  if (from === "undefined" || from === "null") return "/";
  if (!from.startsWith("/")) return "/";
  if (from.startsWith("//")) return "/";
  // 检查 path segment 是否含字面量 undefined/null（saas 模板插值产生的 /undefined/... 形式）
  const segments = from.split("/").filter(Boolean);
  if (segments.some((s) => BAD_PATH_SEGMENTS.has(s))) return "/";
  return from;
}

/** 暴露 BAD 名单供 BadPathRedirect 共用 */
export { BAD_PATH_SEGMENTS };
