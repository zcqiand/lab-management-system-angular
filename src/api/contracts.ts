// Sprint 1 前端绑定契约消费入口（移植自 lab-management-system-react/src/api/contracts.ts，
// REQ-2026-031 全量同步）。
// SSOT: ../lab-management-system-shared/tsp/contracts/frontend-bind.tsp
//       → generated/openapi/openapi.yaml components.schemas
//       → orval → src/api/endpoints/model/（按 schema 拆 1 文件，此处只 re-export + 派生）
// 本文件不引入 runtime 库；行为签名见 shared/.state/decision-log.md §2。

import { AuthHeaderKind, BackendId } from "./endpoints/model";
import type {
  AuthState,
  BackendRegistry,
  BackendConfig,
  AuthContext,
  AuthStateAnonymous,
  AuthStateAnonymousValue,
  AuthStateAuthenticated,
  AuthStateAuthenticatedValue,
  AuthStateAwaitingTenant,
  AuthStateAwaitingTenantValue,
  AuthStateIdle,
  AuthStateIdleValue,
  BackendFeatures,
  TokenStorageKeys,
} from "./endpoints/model";

export type {
  AuthContext,
  AuthState,
  AuthStateAnonymous,
  AuthStateAnonymousValue,
  AuthStateAuthenticated,
  AuthStateAuthenticatedValue,
  AuthStateAwaitingTenant,
  AuthStateAwaitingTenantValue,
  AuthStateIdle,
  AuthStateIdleValue,
  BackendConfig,
  BackendFeatures,
  BackendRegistry,
  TokenStorageKeys,
};
export { AuthHeaderKind, BackendId };

// 行为契约（decision-log §2.1/§2.2 的 TS 签名；TypeSpec 不允许 model 挂方法，此处落地）

/** 切换激活后端；持久化由消费方负责 */
export type SwitchBackendFn = (id: BackendId) => void;

/** 订阅后端切换事件；返回 unsub 函数 */
export type OnBackendSwitchHandler = (newId: BackendId) => void;
export type UnsubscribeFn = () => void;

/** AuthContext 行为签名（Angular 侧由 src/state/auth-store.service.ts 实现） */
export interface AuthContextActions {
  login(
    req: import("./endpoints/model").LoginRequest,
  ): Promise<
    import("./endpoints/model").LoginResponse | import("./endpoints/model").ErrorResponse
  >;
  logout(): Promise<void>;
  /** 静默刷新：基于 refreshToken；401 时退到 anonymous */
  refresh(): Promise<
    import("./endpoints/model").LoginResponse | import("./endpoints/model").ErrorResponse
  >;
  /** 登录后选租户（仅在 awaiting_tenant 态可调） */
  switchTenant(
    req: import("./endpoints/model").SwitchTenantRequest,
  ): Promise<
    import("./endpoints/model").LoginResponse | import("./endpoints/model").ErrorResponse
  >;
  /** RBAC 单点判断（来自 /auth/permissions 缓存） */
  hasPermission(perm: string): boolean;
  onChange(handler: (state: AuthState) => void): UnsubscribeFn;
}

// 持久化 key 常量 — TokenStorageKeys 契约的运行时形态。
// orval 对字符串字面量类型生成 TokenStorageKeysAccessToken 等独立枚举，
// 这里直接展平成常量对象，避免消费点写裸字符串。
// activeBackend 是 react 实现层扩展（后端切换器覆盖 key），不在 4 键契约内。
export const TOKEN_STORAGE_KEYS = {
  accessToken: "lab.accessToken",
  refreshToken: "lab.refreshToken",
  activeTenantId: "lab.activeTenantId",
  activeBackend: "lab.activeBackend",
  permissionsCache: "lab.permissions",
} as const;

// 4 槽位默认注册表 — BackendConfig 契约的 lab family 缺省值（信息性）。
// ADR-0014：运行时不再切后端；baseUrl 仍走 backend-config（Angular 无构建期 env
// 注入点，dev 默认 http://localhost:5201，见 src/api/backend-config.ts）。
// 这里 3 个槽位的 baseUrl 都回退 getApiBaseUrl()（无独立 default），
// 保留 BACKEND_REGISTRY_DEFAULT 仅作为契约类型的展示 — LoginPage 已不再查它。
import { getApiBaseUrl } from "./backend-config";

export const BACKEND_REGISTRY_DEFAULT: BackendRegistry = {
  // 2026-09-17 msw 仓已删：msw 槽位移除（BackendId 枚举的 msw 成员待 shared tsp 契约清理同步收）
  active: "nextjs",
  available: [
    {
      id: "nextjs",
      label: "Next.js API",
      baseUrl: getApiBaseUrl(),
      authHeader: "Authorization",
      ssoCallbackPath: "/api/auth/sso/callback",
      features: { sso: true, realDb: true },
    },
    {
      id: "springboot",
      label: "Spring Boot",
      baseUrl: getApiBaseUrl(),
      authHeader: "Authorization",
      features: { sso: true, realDb: true },
    },
    {
      id: "aspnetcore",
      label: "ASP.NET Core",
      baseUrl: getApiBaseUrl(),
      authHeader: "Authorization",
      features: { sso: true, realDb: true },
    },
  ],
};
