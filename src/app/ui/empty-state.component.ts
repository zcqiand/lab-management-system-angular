// EmptyState — 空态（移植 lab-react empty-state.tsx / saas-angular 同名组件）。
// 列表无数据、搜索无结果统一走这里；禁止裸"暂无数据"文本。
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";

@Component({
  selector: "app-empty-state",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: ` <div class="es-wrap" data-testid="empty-state">
    @if (icon()) {
      <mat-icon class="es-icon">{{ icon() }}</mat-icon>
    }
    <div>
      <p class="es-title">{{ title() }}</p>
      @if (descriptionText()) {
        <p class="es-desc">{{ descriptionText() }}</p>
      }
    </div>
    <div class="es-action"><ng-content select="[esAction]" /></div>
  </div>`,
  styles: [
    `
      .es-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        text-align: center;
        border: 1px dashed #cbd5e1;
        border-radius: 8px;
        padding: 3rem 1.5rem;
      }
      .es-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        color: var(--app-muted, #94a3b8);
      }
      .es-title {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 500;
      }
      .es-desc {
        margin: 0.25rem 0 0;
        color: var(--app-muted, #64748b);
        font-size: 0.875rem;
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  /** material icon 名（react 用 lucide 组件，angular 用 Material 图标名） */
  readonly icon = input<string>("");
  readonly descriptionText = input<string>("");
}
