// ReportReviewPage — 薄 wrapper（react src/pages/ReportReviewPage.tsx 1:1 转写）。
// M03.F05 报告审核 — 流程线第四环节。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ReportPhasePageComponent } from "../features/reports/report-phase-page";

@Component({
  selector: "app-report-review-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReportPhasePageComponent],
  template: `
    <app-report-phase-page
      title="报告审核"
      subtitle="审核通过后进入报告批准（flowStatus=review）"
      stage="review"
      submitLabel="审核通过"
      i01DataFn="M03.F05.I01"
      i02DataFn="M03.F05.I02"
    />
  `,
})
// @entry M03.F05.I01 审核队列
// @entry M03.F05.I02 审核通过按钮（i02DataFn 透传 ReportPhasePage）
export class ReportReviewPageComponent {}
