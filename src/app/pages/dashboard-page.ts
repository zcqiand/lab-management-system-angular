// DashboardPage — 薄 wrapper（react src/pages/DashboardPage.tsx 1:1 转写：
// 只渲染 SummaryList；/ 与 /dashboard 两路由同渲染，V016 菜单路径对齐）。
// M05.F01 报告汇总 + 仪表盘统计（L-T4 批真化，替代 L-T0 EmptyState 占位）。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { SummaryListComponent } from "../features/summary/summary-list";

@Component({
  selector: "app-dashboard-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SummaryListComponent],
  template: `<app-summary-list />`,
})
export class DashboardPageComponent {}
