// 后端配置 — 移植自 lab-management-system-react/src/api/backend-config.ts（REQ-2026-031）。
// 差异：无 Vite import.meta.env —— IS_PROD_BUILD 用 Angular isDevMode() 判
//（ng serve=dev 端口表 / ng build 默认 configuration=production → prod 域名表），
// env.VITE_API_BASE_URL 通道无构建期注入点，dev 默认值即常量 "http://localhost:5201"。
// env 回落语义对齐 lab-react src/lib/env.ts：apiMode 默认 "nextjs"、
// saasBaseUrl 默认 http://localhost:5101（SSO 跳板展示用）。
//
// 语义（原文照抄 react 仓）：
//   - KNOWN_BACKENDS 是唯一合法后端集合（msw 仓 2026-09-17 已删，不在列）；
//   - 覆盖持久化在 localStorage（lab.backend.override = mode），读不到/非法时
//     回落 env（VITE_API_BASE_URL / VITE_API_MODE）——env 仍是部署期权威缺省；
//   - 切换由 BackendSwitcher 负责：写覆盖 + 清本机会话（跨后端 token 不通用，
//     陈旧 token 会 401）+ 整页刷新，见 state/auth-store.service.ts clearPersistedSession。
//
// 读取必须惰性 + try/catch：本模块被 node 测试环境（无 window）与浏览器共用。

import { isDevMode } from "@angular/core";

export type BackendMode = "nextjs" | "aspnetcore" | "springboot";

export interface BackendEntry {
  mode: BackendMode;
  label: string;
  baseUrl: string;
}

/** 家族三真后端（端口 SSOT：multi-repo-family.md §6，5200 段 = lab） */
export const KNOWN_BACKENDS: BackendEntry[] = [
  { mode: "nextjs", label: "Next.js API", baseUrl: "http://localhost:5201" },
  { mode: "aspnetcore", label: "ASP.NET Core", baseUrl: "http://localhost:5204" },
  { mode: "springboot", label: "Spring Boot", baseUrl: "http://localhost:5205" },
];

/** prod 域名表（saas-angular 同款：ng build production 时启用）。
 *  prod URL 真源=各仓 .env.production / deploy vhost，此处是索引。 */
const PROD_BASE_URLS: Record<BackendMode, string> = {
  nextjs: "https://lab-nextjs.xiangru.uk",
  aspnetcore: "https://lab-aspnetcore.xiangru.uk",
  springboot: "https://lab-springboot.xiangru.uk",
};

function IS_PROD_BUILD(): boolean {
  return !isDevMode();
}

/** env 派生缺省（lab-react src/lib/env.ts 的 apiBaseUrl/apiMode 默认值等价物）。
 *  dev = 真 nextjs :5201；prod = 家族 prod 域名（isDevMode 判构建形态）。 */
function envBackend(): BackendEntry {
  const mode: BackendMode = "nextjs";
  return {
    mode,
    label: mode,
    baseUrl: IS_PROD_BUILD() ? PROD_BASE_URLS[mode] : "http://localhost:5201",
  };
}

const OVERRIDE_KEY = "lab.backend.override";

function readOverride(): BackendMode | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(OVERRIDE_KEY);
    if (!raw) return null;
    return KNOWN_BACKENDS.some((b) => b.mode === raw) ? (raw as BackendMode) : null;
  } catch {
    return null;
  }
}

/** 当前活动后端：localStorage 覆盖（dev 切后端）优先，否则 env 派生。
 *  2026-09-25 修复纪律照抄 react 仓：localStorage 没 override → 总是 env 派生
 * （dev=真后端 :5201 / prod=域名）；override 才有 → KNOWN_BACKENDS[override]
 * （localhost dev URL，仅 dev 用；prod 构建下 override 不生效——切后端是 dev 面）。 */
export function getActiveBackend(): BackendEntry {
  const override = readOverride();
  if (override && !IS_PROD_BUILD()) {
    return KNOWN_BACKENDS.find((b) => b.mode === override)!;
  }
  return envBackend();
}

export function getApiBaseUrl(): string {
  return getActiveBackend().baseUrl;
}

export function getApiMode(): string {
  return getActiveBackend().mode;
}

/** saas 身份平台展示地址（SSO 跳板说明行用；真跳转走 lab 后端 authorize 端点） */
export function getSaasBaseUrl(): string {
  return IS_PROD_BUILD() ? "https://saas-nextjs.xiangru.uk" : "http://localhost:5101";
}

/** 写运行时覆盖；注册表外 mode 直接 throw（防脏值静默失效） */
export function setBackendOverride(mode: BackendMode): void {
  const hit = KNOWN_BACKENDS.find((b) => b.mode === mode);
  if (!hit) throw new Error(`unknown backend mode: ${mode}`);
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(OVERRIDE_KEY, mode);
}

export function clearBackendOverride(): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * OAuth 2.0 client_id（LoginPage authorize/callback 用）。
 * 契约必填参数，但真 client_id 由 lab 后端 env 权威持有（springboot
 * LAB_SAAS_CLIENT_ID；nextjs SAAS_OAUTH_CLIENT_ID），前端传的值会被后端忽略，
 * saas authorize 端点按库值 'lab-management' 查 oauth_client（2026-09-14 实测）。
 * Angular 无构建期 env 注入点（见文件头），故以常量承载——不是 demo 字面量
 * 兜底：这是本应用（lab-management）的固定自标识，ADR-0019 禁的是租户/用户等
 * 业务身份缺失时猜值（同 saas-angular LOGIN_CLIENT_ID="saas-console" 先例）。
 */
export const SAAS_CLIENT_ID = "lab-management";
