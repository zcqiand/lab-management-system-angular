// LoginPage — M01.F05.I03（SSO OAuth 2.0 授权码流）纯 orchestrator，镜像 nextjs /login。
// 移植自 lab-management-system-react/src/pages/LoginPage.tsx（REQ-2026-031）。
//
// 对齐 nextjs 模型（2026-08-19 OAuth 2.0 收口）：登录全部委托 saas 身份平台走
// OAuth 2.0 授权码模式（RFC 6749），lab 后端 confidential client（持 client_secret）。
// 两分支：
//   1. URL 带 ?code=&state=（saas 已授权）→ 验 state（防 CSRF）→ POST /api/auth/sso/callback
//      换 lab 自家 JWT（grant_type=authorization_code，client_secret 仅后端持有，
//      saas token 不出 lab 后端）→ setSession 进业务页
//   2. 无回调参数 → 生成 state 存 sessionStorage → GET /api/auth/sso/authorize
//      （response_type=code, client_id, redirect_uri, state）→ window.location 跳 saas
// 旧的 ?token= shortcut 已删除：不符合 OAuth 2.0 + 首登缺 refreshToken 必抛错。
// SSO 环路保护（bad-path-redirect flag）保留：saas 返回 /undefined 时降级提示。
//
// Angular 差异：
//   - client_id 无构建期 env 注入点 → SAAS_CLIENT_ID 常量（backend-config.ts 注）；
//   - query 解析用 window.location.search 直读（不依赖 Router query 时序，
//     saas-angular OAuth 跳板同款纪律）；
//   - hydrate 由守卫/App 启动触发，这里只在 anonymous 态发起 SSO effect。
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
} from "@angular/core";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AuthStoreService } from "../../state/auth-store.service";
import { getApiMode, getSaasBaseUrl, SAAS_CLIENT_ID } from "../../api/backend-config";
import { AuthService } from "../../api/endpoints/auth/auth.service";
import { clearSsoBroken, SSO_BROKEN_FLAG } from "../app-shell/bad-path-redirect";
import { sanitizeRedirect } from "../../lib/sanitize-redirect";

const SSO_STATE_STORAGE_KEY = "lab.sso.state";
// 业务回跳路径（?from=）存 sessionStorage 随 state 走。RFC 6749 §3.1.2 要求
// redirect_uri 与注册白名单精确匹配——不能把 from 塞进 redirect_uri（带 query
// 的变体 /login?from=%2F 匹配不上白名单注册的裸 /login，saas 必返 INVALID_REDIRECT_URI）。
const SSO_FROM_STORAGE_KEY = "lab.sso.from";

// 生成 OAuth 2.0 state 字符串（防 CSRF，RFC 6749 §10.12）。
// crypto.getRandomValues 是浏览器原生密码学随机，足够强；生成的字符串 base64url 编码。
function generateOauthState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// 计算 authorize/callback 的 redirect_uri：lab 自己绝对地址的裸 /login 路径。
// RFC 6749 §3.1.2：必须与 saas 注册白名单精确匹配，不带任何 query 参数。
function computeRedirectUri(): string {
  if (typeof window === "undefined") return "/login";
  return `${window.location.origin}/login`;
}

@Component({
  selector: "app-login-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatIconModule],
  templateUrl: "./login-page.html",
  styles: [
    `
      :host {
        display: block;
      }
      .wrap {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: #f1f5f9;
      }
      .card {
        width: 100%;
        max-width: 26rem;
        padding: 2rem;
      }
      .head {
        margin-bottom: 1.5rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
      }
      .head mat-icon {
        font-size: 2rem;
        width: 2rem;
        height: 2rem;
        color: #2563eb;
      }
      .head h1 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
      }
      .head p {
        margin: 0;
        font-size: 0.875rem;
        color: #64748b;
      }
      .status {
        margin: 0 0 1rem;
        font-size: 0.875rem;
        color: #64748b;
      }
      .flow {
        margin: 0;
        font-size: 0.75rem;
        color: rgb(100 116 139 / 0.7);
      }
    `,
  ],
})
export class LoginPageComponent {
  private readonly store = inject(AuthStoreService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly apiMode = getApiMode();
  readonly saasBaseUrl = getSaasBaseUrl();
  readonly status = signal("检查登录态…");

  constructor() {
    // 已登录访问 /login → 直接回业务页
    effect(() => {
      if (this.store.state().kind === "authenticated") {
        const from = new URLSearchParams(window.location.search).get("from");
        void this.router.navigateByUrl(sanitizeRedirect(from), { replaceUrl: true });
      }
    });

    // SSO orchestrator：只在 anonymous 态发起（等 hydrate 完成；否则 effect 多次
    // 跑会覆盖 sessionStorage 的 csrfState，回跳时 state 校验失败——react 同款注释）
    effect(() => {
      const kind = this.store.state().kind;
      if (kind !== "anonymous") return;
      void this.runSsoFlow();
    });
  }

  private async runSsoFlow(): Promise<void> {
    // SSO loop break：saas 端返回 /undefined 字面量时跳过 SSO，显示提示不再跳。
    if (typeof window !== "undefined" && sessionStorage.getItem(SSO_BROKEN_FLAG)) {
      this.status.set(
        "检测到 SSO 重定向环（saas 端返回 /undefined 字面量），已停止自动跳转",
      );
      return;
    }

    // 阶段 1：OAuth 2.0 授权码模式（RFC 6749 §4.1）
    const sp = new URLSearchParams(window.location.search);
    const code = sp.get("code");
    const stateParam = sp.get("state");
    const fromParam = sp.get("from");
    // 回跳时 URL 是裸 /login（redirect_uri 不带 query），from 从 sessionStorage 恢复
    const fromStored =
      typeof window !== "undefined" ? sessionStorage.getItem(SSO_FROM_STORAGE_KEY) : null;
    const from = fromParam ?? fromStored;
    if (code && stateParam) {
      // 验 state：sessionStorage 存的 vs URL 回跳的必须一致（防 CSRF 攻击）。
      // 失败说明 state 被偷换或 session 过期，拒换 token 并清掉 storage 让用户重试。
      const expectedState =
        typeof window !== "undefined"
          ? sessionStorage.getItem(SSO_STATE_STORAGE_KEY)
          : null;
      if (!expectedState || expectedState !== stateParam) {
        this.status.set("state 校验失败（可能 session 过期或被攻击），请重新登录");
        sessionStorage.removeItem(SSO_STATE_STORAGE_KEY);
        return;
      }
      // state 验证通过，立即清掉（一次性）
      sessionStorage.removeItem(SSO_STATE_STORAGE_KEY);
      // 清掉 URL 上的 code/state 防止 reload 时重复触发阶段 1
      sp.delete("code");
      sp.delete("state");
      const cleanSearch = sp.toString();
      const cleanUrl = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : "");

      this.status.set("拿到 saas code，正在换 token…");
      try {
        const resp = await firstValueFrom(
          this.auth.authSsoCallback({
            grant_type: "authorization_code",
            code,
            redirect_uri: computeRedirectUri(),
            // RFC 6749 §4.1.3 + shared 契约四字段：state 原样回传（后端 cookie 校验 CSRF）
            state: stateParam,
          }),
        );
        if (resp.token) {
          clearSsoBroken();
          await this.store.setSession({
            accessToken: resp.token,
            user: resp.user,
            tenants: resp.tenants,
            refreshToken: resp.refreshToken,
          });
          // 用 replace 清掉 URL 残留（code/state 已删，replace 也保证不留历史记录）
          window.history.replaceState(null, "", cleanUrl);
          sessionStorage.removeItem(SSO_FROM_STORAGE_KEY);
          await this.router.navigateByUrl(sanitizeRedirect(from), { replaceUrl: true });
        } else {
          this.status.set("code 换 token 失败：响应无 token");
        }
      } catch (err) {
        // 响应体打到 console，下次触发直接能看到 INVALID_GRANT 的 message 字符串
        console.error("sso callback failed:", err);
        // 失败也清掉 URL 残留的 code/state——dev server 重启会让同一个 code 第二次
        // callback 必返 INVALID_GRANT；清掉后用户能直接重新走登录流程。
        window.history.replaceState(null, "", cleanUrl);
        this.status.set(`code 换 token 失败（${(err as Error).message ?? "unknown"}）`);
      }
      return;
    }

    // 阶段 2：无回调参数 → 调 authorize 让 saas 跳过来
    this.status.set(`未登录，正在跳 saas 身份平台（backend=${this.apiMode}）…`);
    // from 存 sessionStorage 随 state 走（redirect_uri 保持裸 /login 精确匹配白名单）
    if (from) sessionStorage.setItem(SSO_FROM_STORAGE_KEY, from);
    // 幂等：effect 多次跑时复用已存的 csrfState，避免用不同 state 覆盖
    // sessionStorage 导致回跳时 state 校验失败。
    let csrfState = sessionStorage.getItem(SSO_STATE_STORAGE_KEY);
    if (!csrfState) {
      csrfState = generateOauthState();
      sessionStorage.setItem(SSO_STATE_STORAGE_KEY, csrfState);
    }
    try {
      const resp = await firstValueFrom(
        this.auth.authSsoAuthorize({
          response_type: "code",
          client_id: SAAS_CLIENT_ID,
          redirect_uri: computeRedirectUri(),
          state: csrfState,
        }),
      );
      const url = resp.authorizeUrl;
      if (url) {
        window.location.href = url;
      } else {
        this.status.set("authorizeUrl 缺失，请检查 saas 配置");
      }
    } catch (err) {
      this.status.set(`SSO 跳转失败（${(err as Error).message ?? "unknown"}）`);
      sessionStorage.removeItem(SSO_STATE_STORAGE_KEY);
    }
  }
}
