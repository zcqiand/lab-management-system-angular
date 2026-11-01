// TenantSwitcher（M00.F02.I01）— header 右侧租户切换下拉。
// 移植自 lab-management-system-react/src/components/app/tenant-switcher.tsx（REQ-2026-031）：
//   - 候选清单来自 AuthStoreService.sessionTenantsList()（settleLogin/hydrate 同步）；
//   - 切换走契约 POST /api/auth/switch-tenant → 后端换发新 tenant claim 的
//     HS256 token，会话不中断；
//   - 成功后整页刷新（angular-query 缓存按旧租户 bake，跨租户不通用）；
//     测试可注 onSwitched 桩——angular 侧经 inject(TENANT_SWITCH_RELOAD) 注入。
// 错误就地展示在触发器下方：mat-menu 点选菜单项即关菜单，错误若渲染在菜单
// 里会随菜单卸载而不可见（react 版同款裁定）。
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatButtonModule } from "@angular/material/button";
import { AuthStoreService, isErrorResponse } from "../../state/auth-store.service";

function defaultReload(): void {
  window.location.reload();
}

@Component({
  selector: "app-tenant-switcher",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatMenuModule, MatIconModule],
  template: `
    <div class="wrap">
      <button
        mat-stroked-button
        [matMenuTriggerFor]="menu"
        data-testid="tenant-switcher"
        data-fn="M00.F02.I01"
        [title]="current()?.name ?? '选择租户'"
        class="trigger"
      >
        <mat-icon>apartment</mat-icon>
        <span class="name">{{ current()?.name ?? "选择租户" }}</span>
        <mat-icon class="small">unfold_more</mat-icon>
      </button>
      <mat-menu #menu="matMenu">
        <div class="menu-label">切换租户</div>
        @for (t of tenants(); track t.tenantId) {
          <button
            mat-menu-item
            (click)="onSwitch(t.tenantId)"
            [attr.data-testid]="'tenant-option-' + t.tenantId"
          >
            <mat-icon>apartment</mat-icon>
            <span class="col">
              <span class="tname">{{ t.name }}</span>
              <span class="tcode">{{ t.code }}</span>
            </span>
          </button>
        }
      </mat-menu>
      @if (error()) {
        <p class="error" data-testid="tenant-switcher-error">{{ error() }}</p>
      }
    </div>
  `,
  styles: [
    `
      .wrap {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.25rem;
      }
      .trigger {
        gap: 0.5rem;
      }
      .name {
        max-width: 10rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-weight: 500;
      }
      .small {
        transform: scale(0.75);
        opacity: 0.55;
      }
      .menu-label {
        padding: 0.5rem 1rem;
        font-size: 0.75rem;
        opacity: 0.6;
      }
      .col {
        display: flex;
        flex-direction: column;
      }
      .tname {
        font-weight: 500;
      }
      .tcode {
        font-size: 0.7rem;
        font-family: monospace;
        opacity: 0.55;
      }
      .error {
        margin: 0;
        font-size: 0.75rem;
        color: #dc2626;
      }
    `,
  ],
})
export class TenantSwitcher {
  private readonly store = inject(AuthStoreService);

  readonly error = signal("");
  private readonly pending = signal(false);

  readonly current = this.store.currentTenant;
  readonly tenants = () => this.store.sessionTenantsList();

  /** 切换成功回调（AppShell 用默认整页刷新；测试注桩覆盖此字段） */
  onSwitched: () => void = defaultReload;

  async onSwitch(tenantId: string): Promise<void> {
    if (this.pending()) return;
    const current = this.current();
    if (current && tenantId === current.tenantId) return;
    this.pending.set(true);
    this.error.set("");
    const resp = await this.store.switchTenant({ tenantId });
    this.pending.set(false);
    if (isErrorResponse(resp)) {
      // toApiError 走 HttpClient error message（含状态码，如
      // "Http failure response ... 404"），404=目标租户不存在或非成员
      this.error.set(
        resp.message.includes("404")
          ? "该租户不存在或你不是其成员"
          : `切换失败：${resp.message}`,
      );
      return;
    }
    this.onSwitched();
  }
}
