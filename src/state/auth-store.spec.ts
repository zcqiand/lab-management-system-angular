// AuthStoreService FSM 行为 spec（REQ-2026-031 T-L0，工程基建面）。
// 移植自 lab-management-system-react/tests/auth-fsm.test.ts 的行为矩阵；fn ID
// 挂载留待 L-T4 认证域壳层回归批（此处不挂，避免 trace 假覆盖）。
//
// HTTP 面：provideHttpClientTesting 打桩——FSM 行为矩阵要的是确定性请求/响应
// 编排，不是真链路（真链路 /me 语义已由 real-chain.probe.spec.ts + global-setup
// 探针覆盖；membership 快照由真 login 写入，铸造 token 打 /me 必 401 是
// ADR-0019 的正确表现，见 probe spec 头注）。
import { TestBed } from "@angular/core/testing";
import {
  HttpClientTestingModule,
  HttpTestingController,
} from "@angular/common/http/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { AuthStoreService, isErrorResponse } from "./auth-store.service";
import { TOKEN_STORAGE_KEYS } from "../api/contracts";

const USER = { id: "u1", username: "admin" };
const TENANT_A = { tenantId: "t-a", code: "ACME", name: "甲公司", roleIds: [] };
const TENANT_B = { tenantId: "t-b", code: "BETA", name: "乙公司", roleIds: [] };

function loginResponse(tenants: (typeof TENANT_A)[], token = "tok-1") {
  return { token, refreshToken: "rt-1", user: USER, tenants };
}

/**
 * 排store：login 打桩响应 + settleLogin 连带的 /api/auth/permissions。
 * permissions 请求在 login flush 之后的微任务续体里才发出——中间必须让出一个
 * 宏任务 tick 再 expectOne（jsdom 下 setTimeout 0 排空微任务链）。
 */
async function flushLogin(ctrl: HttpTestingController, body: object): Promise<void> {
  ctrl.expectOne((r) => r.url === "/api/auth/login").flush(body);
  await new Promise((r) => setTimeout(r, 0));
  ctrl
    .expectOne((r) => r.url === "/api/auth/permissions")
    .flush({ permissions: ["contract.read"] });
}

describe("AuthStoreService FSM（工程基建，无 fn ID）", () => {
  let store: AuthStoreService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    store = TestBed.inject(AuthStoreService);
    ctrl = TestBed.inject(HttpTestingController);
  });

  it("idle 起点：无 token hydrate 落 anonymous", async () => {
    await store.hydrate();
    expect(store.state().kind).toBe("anonymous");
  });

  it("login 单租户：直进 authenticated，token/refresh/activeTenantId 全落盘，权限面接通", async () => {
    const resp = store.login({ username: "admin", password: "x" });
    await flushLogin(ctrl, loginResponse([TENANT_A]));
    const out = await resp;
    expect(isErrorResponse(out)).toBe(false);
    const s = store.state();
    expect(s.kind).toBe("authenticated");
    if (s.kind !== "authenticated") return;
    expect(s.value.tenant.tenantId).toBe("t-a");
    expect(s.value.permissions).toEqual(["contract.read"]);
    expect(localStorage.getItem(TOKEN_STORAGE_KEYS.accessToken)).toBe("tok-1");
    expect(localStorage.getItem(TOKEN_STORAGE_KEYS.refreshToken)).toBe("rt-1");
    expect(localStorage.getItem(TOKEN_STORAGE_KEYS.activeTenantId)).toBe("t-a");
    expect(store.hasPermission("contract.read")).toBe(true);
    expect(store.hasPermission("nope")).toBe(false);
    ctrl.verify();
  });

  it("login 多租户有记忆：localStorage.activeTenantId 命中者优先（2026-09-23 裁定）", async () => {
    localStorage.setItem(TOKEN_STORAGE_KEYS.activeTenantId, "t-b");
    const resp = store.login({ username: "admin", password: "x" });
    await flushLogin(ctrl, loginResponse([TENANT_A, TENANT_B]));
    await resp;
    const s = store.state();
    expect(s.kind).toBe("authenticated");
    if (s.kind !== "authenticated") return;
    expect(s.value.tenant.tenantId).toBe("t-b");
    ctrl.verify();
  });

  it("login 空租户列表：落 awaiting_tenant（唯一可达路径）", async () => {
    const resp = store.login({ username: "admin", password: "x" });
    // 空租户不取 permissions（settleLogin 短路）
    ctrl.expectOne((r) => r.url === "/api/auth/login").flush(loginResponse([]));
    await resp;
    const s = store.state();
    expect(s.kind).toBe("awaiting_tenant");
    ctrl.verify();
  });

  it("refresh 无 refreshToken：NO_REFRESH_TOKEN + 退 anonymous", async () => {
    const out = await store.refresh();
    expect(isErrorResponse(out)).toBe(true);
    if (!isErrorResponse(out)) return;
    expect(out.code).toBe("NO_REFRESH_TOKEN");
    expect(store.state().kind).toBe("anonymous");
  });

  it("refresh 401：清盘退 anonymous", async () => {
    localStorage.setItem(TOKEN_STORAGE_KEYS.refreshToken, "rt-stale");
    localStorage.setItem(TOKEN_STORAGE_KEYS.accessToken, "tok-stale");
    const p = store.refresh();
    ctrl
      .expectOne((r) => r.url === "/api/auth/refresh")
      .flush(
        { code: "UNAUTHORIZED", message: "expired" },
        { status: 401, statusText: "Unauthorized" },
      );
    const out = await p;
    expect(isErrorResponse(out)).toBe(true);
    expect(store.state().kind).toBe("anonymous");
    expect(localStorage.getItem(TOKEN_STORAGE_KEYS.accessToken)).toBeNull();
    expect(localStorage.getItem(TOKEN_STORAGE_KEYS.refreshToken)).toBeNull();
    ctrl.verify();
  });

  it("switchTenant 在 anonymous：WRONG_STATE 且零网络", async () => {
    await store.hydrate();
    const out = await store.switchTenant({ tenantId: "t-a" });
    expect(isErrorResponse(out)).toBe(true);
    if (!isErrorResponse(out)) return;
    expect(out.code).toBe("WRONG_STATE");
    ctrl.verify();
  });

  it("logout：best-effort 打 /api/auth/logout 后清盘退 anonymous", async () => {
    const p = store.login({ username: "admin", password: "x" });
    await flushLogin(ctrl, loginResponse([TENANT_A]));
    await p;
    const p2 = store.logout();
    ctrl.expectOne((r) => r.url === "/api/auth/logout").flush(null);
    await p2;
    expect(store.state().kind).toBe("anonymous");
    expect(localStorage.getItem(TOKEN_STORAGE_KEYS.accessToken)).toBeNull();
    expect(store.hasPermission("contract.read")).toBe(false);
    ctrl.verify();
  });

  it("setSession 缺 refreshToken/user 必抛（ADR-0019：不猜会话）", async () => {
    await expect(
      store.setSession({ accessToken: "tok-9", tenants: [TENANT_A] }),
    ).rejects.toThrow(/requires accessToken \+ user \+ refreshToken/);
  });

  it("setSession 全参：SSO callback 语义直进 authenticated", async () => {
    const p = store.setSession({
      accessToken: "tok-sso",
      refreshToken: "rt-sso",
      user: USER,
      tenants: [TENANT_A],
    });
    ctrl.expectOne((r) => r.url === "/api/auth/permissions").flush({ permissions: [] });
    await p;
    expect(store.state().kind).toBe("authenticated");
    expect(localStorage.getItem(TOKEN_STORAGE_KEYS.accessToken)).toBe("tok-sso");
    ctrl.verify();
  });
});
