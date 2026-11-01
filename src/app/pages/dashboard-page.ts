// DashboardPage — L-T0 占位（route 已占坑，侧栏点进去不 404）。
// react 版是 SummaryList 真页面（/ 与 /dashboard 同渲染），本批随报告流批
//（L-T4）移植为真实现；脚手架策略照 react App.tsx：未落地批次先挂 EmptyState。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { EmptyStateComponent } from "../ui/empty-state.component";

@Component({
  selector: "app-dashboard-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent],
  template: `
    <app-empty-state title="仪表盘" descriptionText="移植中（L-T4 报告流批落地）" />
  `,
})
export class DashboardPageComponent {}
