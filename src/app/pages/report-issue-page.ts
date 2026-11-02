// ReportIssuePage — 薄 wrapper（react src/pages/ReportIssuePage.tsx 1:1 转写）。
// M03.F07 报告发放 — 流程线第六环节（提交时自动生成报告编号）。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ReportPhasePageComponent } from "../features/reports/report-phase-page";

@Component({
  selector: "app-report-issue-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReportPhasePageComponent],
  template: `
    <app-report-phase-page
      title="报告发放"
      subtitle="发放后进入归档（flowStatus=issuance，提交时自动生成报告编号）"
      stage="issuance"
      submitLabel="发放"
      i01DataFn="M03.F07.I01"
      i02DataFn="M03.F07.I02"
    />
  `,
})
// @entry M03.F07.I01 发放队列
// @entry M03.F07.I02 发放按钮（i02DataFn 透传 ReportPhasePage）
export class ReportIssuePageComponent {}
