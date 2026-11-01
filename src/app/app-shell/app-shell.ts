// AppShell — sidebar (left) + header + content (right) 业务页骨架。
// 移植自 lab-management-system-react/src/components/app/app-shell.tsx（REQ-2026-031）。
//
// 差异（镜像改造点）：
//   - 菜单从 lab 后端 /api/auth/menus 拉取（authGetMenus + Bearer lab JWT；
//     2026-08-27 起 demo 兜底删除，miss 503 上抛——react 由 ErrorBoundary 兜，
//     angular 无 error boundary，改 shell 内联渲染菜单错误态，语义等价：
//     错误可见而非静默回退静态树）
//   - 守卫：routes 层 canActivate authGuard（react 把 useRequireAuth 提到壳层）
//   - header 用户区（2026-09-23 用户裁定）：登录用户显示名 + TenantSwitcher
//     （切换成功整页刷新）；authenticated 状态徽标已退役
//   - displayName 回退链必须 || 而非 ??：saas 无显示名 → SSO 落地 displayName=""，
//     ?? 对空串不回退 → header 用户名整个消失（2026-09-23 回归锁，react 同款）
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { Router, RouterOutlet } from "@angular/router";
import { injectQuery } from "@tanstack/angular-query";
import { firstValueFrom } from "rxjs";

import { AuthService } from "../../api/endpoints/auth/auth.service";
import { AuthStoreService } from "../../state/auth-store.service";
import { APP_CODE, APP_NAME } from "../menus";
import { adaptContractMenu, SidebarNavComponent } from "./sidebar-nav";
import { TenantSwitcher } from "./tenant-switcher";
import { BackendSwitcher } from "./backend-switcher";

@Component({
  selector: "app-app-shell",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    MatButtonModule,
    MatIconModule,
    SidebarNavComponent,
    TenantSwitcher,
    BackendSwitcher,
  ],
  templateUrl: "./app-shell.html",
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: #f8fafc;
      }
      .layout {
        min-height: 100vh;
        display: flex;
      }
      .menu-error {
        width: 16rem;
        flex-shrink: 0;
        border-right: 1px solid #e2e8f0;
        background: #fff;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        text-align: center;
      }
      .menu-error h2 {
        margin: 0 0 0.5rem;
        font-size: 1rem;
        font-weight: 600;
        color: #be123c;
      }
      .menu-error .msg {
        margin: 0 0 1rem;
        font-size: 0.75rem;
        color: #475569;
        word-break: break-all;
      }
      .menu-error .hint {
        margin: 0;
        font-size: 0.75rem;
        color: #64748b;
      }
      .loading {
        width: 16rem;
        flex-shrink: 0;
        border-right: 1px solid #e2e8f0;
        background: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        color: #64748b;
      }
      main {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      header {
        height: 3.5rem;
        background: #fff;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        padding: 0 1.5rem;
        gap: 1rem;
      }
      header h1 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
      }
      .user-area {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.75rem;
        color: #64748b;
      }
      .user-name {
        font-family: monospace;
      }
      section {
        flex: 1;
        overflow: auto;
        padding: 1.5rem;
      }
    `,
  ],
})
export class AppShell {
  private readonly store = inject(AuthStoreService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly appName = APP_NAME;
  readonly appCode = APP_CODE;

  readonly state = this.store.state;

  // 菜单从 lab 后端 /api/auth/menus 拉：失败上抛语义 → 内联错误态
  //（demo 兜底删除后不再静默回退静态树）
  private readonly menusQ = injectQuery(() => ({
    queryKey: ["authGetMenus"],
    queryFn: () => firstValueFrom(this.auth.authGetMenus()),
    retry: false,
    staleTime: 5 * 60 * 1000,
  }));

  readonly menusLoading = computed(() => this.menusQ.isPending());

  /** 契约 MenuNode → 本地渲染树（react adaptContractMenu 同款） */
  readonly menus = computed(() => {
    const data = this.menusQ.data();
    return data ? data.map((n, i) => adaptContractMenu(n, i, APP_CODE)) : null;
  });

  readonly menusError = computed(() => this.menusQ.error() as Error | null);

  // || 而非 ??：saas 无显示名 → displayName="" 时回退 username（2026-09-23 回归锁）
  readonly displayName = computed(() => {
    const s = this.state();
    if (s.kind === "authenticated" || s.kind === "awaiting_tenant") {
      return s.value.user.displayName || s.value.user.username;
    }
    return "";
  });

  async onLogout(): Promise<void> {
    await this.store.logout();
    await this.router.navigate(["/login"]);
  }
}
