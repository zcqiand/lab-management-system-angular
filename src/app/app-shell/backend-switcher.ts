// BackendSwitcher — 侧栏底部运行时选择 lab 家族三真后端（msw 仓 2026-09-17 已删）。
// 移植自 lab-management-system-react/src/components/app/backend-switcher.tsx
//（REQ-2026-031）。2026-09-23 用户裁定收窄 ADR-0014：恢复后端切换器，
// dev/书稿演示需要在一套前端下对比三个真后端。落位在侧栏 footer（深色底，
// trigger 用文字按钮 + white/70 适配）。
//
// 切换语义（backend-config.ts）：写 localStorage 覆盖 → 清本机会话
//（跨后端 token 不通用，陈旧 token 401）→ 整页刷新拉新后端数据。
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatButtonModule } from "@angular/material/button";
import {
  KNOWN_BACKENDS,
  getActiveBackend,
  setBackendOverride,
  type BackendMode,
} from "../../api/backend-config";
import { AuthStoreService } from "../../state/auth-store.service";

@Component({
  selector: "app-backend-switcher",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatMenuModule, MatIconModule],
  template: `
    <button
      mat-button
      [matMenuTriggerFor]="menu"
      data-testid="backend-switcher-trigger"
      [title]="'当前后端：' + active().label + ' · ' + active().baseUrl"
      class="trigger"
    >
      <mat-icon>dns</mat-icon>
      <span class="mode">{{ active().mode }}</span>
      <mat-icon class="small">unfold_more</mat-icon>
    </button>
    <mat-menu #menu="matMenu" xPosition="after" [hasBackdrop]="true">
      <div class="menu-label">后端（运行时切换）</div>
      @for (b of backends; track b.mode) {
        <button
          mat-menu-item
          (click)="onPick(b.mode)"
          [attr.data-testid]="'backend-option-' + b.mode"
          [class.active]="b.mode === active().mode"
        >
          <span class="col">
            <span class="label">{{ b.label }}</span>
            <span class="url">{{ b.baseUrl }}</span>
          </span>
        </button>
      }
    </mat-menu>
  `,
  styles: [
    `
      .trigger {
        width: 100%;
        justify-content: flex-start;
        gap: 0.5rem;
        color: rgb(255 255 255 / 0.7);
        font-size: 0.75rem;
      }
      .mode {
        font-family: monospace;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .small {
        margin-left: auto;
        transform: scale(0.75);
        opacity: 0.6;
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
      .label {
        font-weight: 500;
      }
      .url {
        font-size: 0.7rem;
        font-family: monospace;
        opacity: 0.55;
      }
    `,
  ],
})
export class BackendSwitcher {
  private readonly store = inject(AuthStoreService);

  readonly backends = KNOWN_BACKENDS;

  /** 挂载时读一次即可：整页刷新是切换的唯一出口，不存在运行中变位（react 同款） */
  private readonly activeEntry = getActiveBackend();
  active(): { mode: string; label: string; baseUrl: string } {
    return this.activeEntry;
  }

  private switching = false;

  onPick(mode: BackendMode): void {
    if (mode === this.activeEntry.mode || this.switching) return;
    this.switching = true;
    setBackendOverride(mode);
    this.store.clearPersistedSession();
    window.location.reload();
  }
}
