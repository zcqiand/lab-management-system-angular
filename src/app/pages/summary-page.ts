// SummaryPage — 薄 wrapper（react src/pages/SummaryPage.tsx 1:1 转写：同渲染
// SummaryList；react DashboardPage 也是 SummaryList 壳，见 dashboard-page.ts）。
// M05.F01 报告汇总 + 仪表盘统计。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { SummaryListComponent } from "../features/summary/summary-list";

@Component({
  selector: "app-summary-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SummaryListComponent],
  template: `<app-summary-list />`,
})
export class SummaryPageComponent {}
