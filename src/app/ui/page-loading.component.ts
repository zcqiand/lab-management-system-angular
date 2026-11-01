// PageLoading — 统一加载中（移植 lab-react page-loading.tsx / saas-angular 同名组件）。
// 列表页 loading 态与路由 fallback 都走这里；禁止各页手写"加载中…"。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";

@Component({
  selector: "app-page-loading",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatProgressSpinnerModule],
  template: ` <div
    class="pl-wrap"
    role="status"
    aria-live="polite"
    data-testid="page-loading"
  >
    <mat-spinner diameter="24" />
    <span>加载中…</span>
  </div>`,
  styles: [
    `
      .pl-wrap {
        min-height: 200px;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        color: var(--app-muted, #94a3b8);
        font-size: 0.875rem;
      }
    `,
  ],
})
export class PageLoadingComponent {}
