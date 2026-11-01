// AuthStore — Sprint 1 前端绑定契约的 Angular 实现（REQ-2026-031）。
// 移植自 lab-management-system-react/src/state/auth-context.tsx：
// React 模块级 store + Context → Angular signals 服务（zoneless 下 OnPush 直读 signal）。
//
// 契约（shared tsp/contracts/frontend-bind.tsp，TS 签名见 .state/decision-log.md §2.2）：
//   AuthState 4 态 FSM: idle → anonymous → awaiting_tenant → authenticated
//   行为: login / logout / refresh / switchTenant / hasPermission / onChange
//
// FSM 转移表（react 仓同款，decision-log open_questions 留白落成的显式表）：
//   idle        --hydrate()-->            anonymous | authenticated | awaiting_tenant
//   anonymous   --login() 成功-->          authenticated（单租户/多租户无记忆自动选第一个，
//                                          2026-09-23）| awaiting_tenant（空租户列表）
//   awaiting_tenant --switchTenant()-->    authenticated
//   authenticated --switchTenant()-->      awaiting_tenant（换租户走契约同路径）
//   *           --logout()-->              anonymous
//   authenticated --refresh() 401-->       anonymous
//
// 持久化 key 全部来自 TOKEN_STORAGE_KEYS 契约常量（lab.*）。
// permissions 缓存 TTL 5 分钟（decision-log §4 风险表），switchTenant/logout 主动失效。
import { Injectable, computed, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { AuthService } from "../api/endpoints/auth/auth.service";
import type {
  CurrentUserSession,
  ErrorResponse,
  LoginRequest,
  LoginResponse,
  MyTenant,
  SwitchTenantRequest,
} from "../api/endpoints/model";
import { TOKEN_STORAGE_KEYS, type AuthState } from "../api/contracts";
import { toApiError } from "../api/api-error";

const IDLE: AuthState = { kind: "idle", value: { kind: "idle" } };
const ANON: AuthState = { kind: "anonymous", value: { kind: "anonymous" } };

const PERMISSIONS_TTL_MS = 5 * 60 * 1000;

// -- localStorage 读写（key 名锁在 TOKEN_STORAGE_KEYS；react storageOf() 同款探测）--

function storageOf(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    // 访问 localStorage 本身抛异常（隐私模式）— 视为不可用
  }
  return null;
}

function readKey(key: string): string | null {
  const s = storageOf();
  if (!s) return null;
  try {
    return s.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string | null): void {
  const s = storageOf();
  if (!s) return;
  try {
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    // 隐私模式等场景 localStorage 不可用 — 静默降级为会话内状态
  }
}

function isErrorResponse(v: unknown): v is ErrorResponse {
  return typeof v === "object" && v !== null && "code" in v && "message" in v;
}

@Injectable({ providedIn: "root" })
export class AuthStoreService {
  private readonly auth = inject(AuthService);

  // 状态真相：react 模块级 store → signal（zoneless OnPush 直读）
  private readonly _state = signal<AuthState>(IDLE);
  readonly state = this._state.asReadonly();

  // 会话租户清单（TenantSwitcher 候选数据源）：authenticated 态 value 只带当前
  // tenant；候选清单同步于 settleLogin / hydrate（镜像 react sessionTenants）
  private sessionTenants: MyTenant[] = [];

  // permissions 缓存：独立于 AuthState（state.permissions 仍是判断源），纯优化层
  private permissionsCache: { value: string[]; fetchedAt: number } | null = null;

  /** 已认证（FSM authenticated 态）— 路由守卫用 */
  readonly isAuthenticated = computed(() => this._state().kind === "authenticated");

  /** 便捷读：authenticated 态的当前租户（其余态 null） */
  readonly currentTenant = computed(() => {
    const s = this._state();
    return s.kind === "authenticated" ? s.value.tenant : null;
  });

  private setState(next: AuthState): void {
    this._state.set(next);
  }

  /** 当前会话的租户候选清单（仅认证后有值；非响应式，切换组件读一次——react 同款） */
  sessionTenantsList(): MyTenant[] {
    return this.sessionTenants;
  }

  /**
   * 清本机会话（BackendSwitcher 切后端用）：跨后端 token 不通用，带着旧后端的
   * token 打新后端必 401（lab 跨后端陈旧 token 401 教训）。清完由调用方整页刷新。
   */
  clearPersistedSession(): void {
    for (const key of Object.values(TOKEN_STORAGE_KEYS)) {
      writeKey(key, null);
    }
    this.sessionTenants = [];
  }

  private persistTokens(resp: LoginResponse): void {
    writeKey(TOKEN_STORAGE_KEYS.accessToken, resp.token);
    if (resp.refreshToken) writeKey(TOKEN_STORAGE_KEYS.refreshToken, resp.refreshToken);
    else writeKey(TOKEN_STORAGE_KEYS.refreshToken, null);
  }

  private clearPersisted(): void {
    for (const key of Object.values(TOKEN_STORAGE_KEYS)) writeKey(key, null);
  }

  private invalidatePermissions(): void {
    this.permissionsCache = null;
    writeKey(TOKEN_STORAGE_KEYS.permissionsCache, null);
  }

  private async fetchPermissions(token: string): Promise<string[]> {
    if (
      this.permissionsCache &&
      Date.now() - this.permissionsCache.fetchedAt < PERMISSIONS_TTL_MS
    ) {
      return this.permissionsCache.value;
    }
    const resp = await firstValueFrom(
      this.auth.authGetPermissions({
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    const value: string[] = resp.permissions ?? [];
    this.permissionsCache = { value, fetchedAt: Date.now() };
    writeKey(TOKEN_STORAGE_KEYS.permissionsCache, JSON.stringify(value));
    return value;
  }

  /**
   * login 成功后的共同落位：remembered ?? single ?? first，多租户无记忆时自动选
   * 第一个（2026-09-23 用户裁定，修 SSO 回调冻结）。awaiting_tenant 仅剩空租户
   * 列表可达；switchTenant 换租户路径保留。
   */
  private async settleLogin(resp: LoginResponse): Promise<void> {
    this.persistTokens(resp);
    const tenantId = readKey(TOKEN_STORAGE_KEYS.activeTenantId);
    const tenants: MyTenant[] = resp.tenants ?? [];
    this.sessionTenants = tenants;
    const remembered = tenants.find((t) => t.tenantId === tenantId);
    const single = tenants.length === 1 ? tenants[0] : undefined;
    const target = remembered ?? single ?? tenants[0];
    if (target) {
      writeKey(TOKEN_STORAGE_KEYS.activeTenantId, target.tenantId);
      const permissions = await this.fetchPermissions(resp.token).catch(
        () => [] as string[],
      );
      this.setState({
        kind: "authenticated",
        value: {
          kind: "authenticated",
          user: resp.user,
          tenant: target,
          permissions,
          tokenExpiresAt: Date.now() + 30 * 60 * 1000,
        },
      });
    } else {
      this.setState({
        kind: "awaiting_tenant",
        value: { kind: "awaiting_tenant", user: resp.user, tenants },
      });
    }
  }

  async login(req: LoginRequest): Promise<LoginResponse | ErrorResponse> {
    try {
      const resp = await firstValueFrom(this.auth.authLogin(req));
      await this.settleLogin(resp);
      return resp;
    } catch (err) {
      return { code: "LOGIN_FAILED", message: toApiError(err).message };
    }
  }

  /**
   * 直接 setSession（不走 /api/auth/login）：SSO callback 拿到 lab 自家 JWT 后
   * 落会话进业务页。取 partial LoginResponse（缺 refreshToken 时 readKey 兜底）。
   */
  async setSession(partial: {
    accessToken: string;
    refreshToken?: string;
    user?: LoginResponse["user"];
    tenants?: LoginResponse["tenants"];
  }): Promise<void> {
    const refreshToken = partial.refreshToken ?? readKey(TOKEN_STORAGE_KEYS.refreshToken);
    const user = partial.user;
    const tenants = partial.tenants ?? [];
    if (!refreshToken || !user) {
      throw new Error("setSession requires accessToken + user + refreshToken");
    }
    const fullResp: LoginResponse = {
      token: partial.accessToken,
      refreshToken,
      user,
      tenants,
    };
    await this.settleLogin(fullResp);
  }

  async logout(): Promise<void> {
    const token = readKey(TOKEN_STORAGE_KEYS.accessToken);
    if (token) {
      await firstValueFrom(this.auth.authLogout({ token })).catch(() => undefined);
    }
    this.clearPersisted();
    this.invalidatePermissions();
    this.setState(ANON);
  }

  async refresh(): Promise<LoginResponse | ErrorResponse> {
    const refreshToken = readKey(TOKEN_STORAGE_KEYS.refreshToken);
    if (!refreshToken) {
      this.setState(ANON);
      return { code: "NO_REFRESH_TOKEN", message: "无 refreshToken，退回匿名态" };
    }
    try {
      const resp = await firstValueFrom(this.auth.authRefresh({ refreshToken }));
      await this.settleLogin(resp);
      return resp;
    } catch {
      // 契约：401 时退到 anonymous
      this.clearPersisted();
      this.invalidatePermissions();
      this.setState(ANON);
      return { code: "REFRESH_FAILED", message: "刷新失败，退回匿名态" };
    }
  }

  async switchTenant(req: SwitchTenantRequest): Promise<LoginResponse | ErrorResponse> {
    const kind = this._state().kind;
    if (kind !== "awaiting_tenant" && kind !== "authenticated") {
      return {
        code: "WRONG_STATE",
        message: "switchTenant 仅在 awaiting_tenant / authenticated 态可调",
      };
    }
    try {
      const resp = await firstValueFrom(this.auth.authSwitchTenant(req));
      writeKey(TOKEN_STORAGE_KEYS.activeTenantId, req.tenantId);
      this.invalidatePermissions();
      await this.settleLogin(resp);
      return resp;
    } catch (err) {
      return { code: "SWITCH_TENANT_FAILED", message: toApiError(err).message };
    }
  }

  hasPermission(perm: string): boolean {
    const s = this._state();
    return s.kind === "authenticated" ? s.value.permissions.includes(perm) : false;
  }

  /**
   * 从持久化 token 恢复会话；无 token 落 anonymous。App 启动 / 守卫首次命中时调。
   * 幂等：非 idle 态直接返回（react hydrateAuth 同款守卫）。
   */
  async hydrate(): Promise<void> {
    if (this._state().kind !== "idle") return;
    const token = readKey(TOKEN_STORAGE_KEYS.accessToken);
    if (!token) {
      this.setState(ANON);
      return;
    }
    try {
      const session: CurrentUserSession = await firstValueFrom(
        this.auth.authGetCurrentUser({
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      this.sessionTenants = session.tenants ?? [];
      const tenantId =
        readKey(TOKEN_STORAGE_KEYS.activeTenantId) ??
        session.currentTenantId ??
        undefined;
      const tenant = session.tenants.find((t) => t.tenantId === tenantId);
      if (tenant) {
        writeKey(TOKEN_STORAGE_KEYS.activeTenantId, tenant.tenantId);
        const permissions = await this.fetchPermissions(token).catch(
          () => [] as string[],
        );
        this.setState({
          kind: "authenticated",
          value: {
            kind: "authenticated",
            user: session.user,
            tenant,
            permissions,
            tokenExpiresAt: Date.now() + 30 * 60 * 1000,
          },
        });
      } else {
        this.setState({
          kind: "awaiting_tenant",
          value: {
            kind: "awaiting_tenant",
            user: session.user,
            tenants: session.tenants,
          },
        });
      }
    } catch {
      // token 已失效 — 静默刷新一次，仍失败落 anonymous
      await this.refresh();
    }
  }

  /**
   * 守卫用：等 hydrate 完成（idle → 其余态）。守卫是同步判定语义，react 靠
   * useRequireAuth 的 checking 态挡渲染；Angular 侧 canActivate 直接 await 本方法。
   */
  async ensureHydrated(): Promise<AuthState> {
    await this.hydrate();
    return this._state();
  }

  // -- 测试专用入口（react __testActions 同款）----------------------------------

  /** 测试专用：直写任意 FSM 态（dom 测试驱动 authenticated 态） */
  testSetState(next: AuthState): void {
    this.setState(next);
  }

  /** 测试专用：注入会话租户清单（生产同步点在 settleLogin/hydrate） */
  testSetTenants(tenants: MyTenant[]): void {
    this.sessionTenants = tenants;
  }

  /** 测试专用：状态回 idle、清监听与缓存（angular 服务无 listener 列表，只重置态） */
  testReset(): void {
    this._state.set(IDLE);
    this.sessionTenants = [];
    this.permissionsCache = null;
  }
}

export { isErrorResponse };
