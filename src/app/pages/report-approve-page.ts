// ReportApprovePage — 薄 wrapper（react src/pages/ReportApprovePage.tsx 1:1 转写）。
// M03.F06 报告批准 — 流程线第五环节。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ReportPhasePageComponent } from "../features/reports/report-phase-page";

@Component({
  selector: "app-report-approve-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReportPhasePageComponent],
  template: `
    <app-report-phase-page
      title="报告批准"
      subtitle="批准后进入报告发放（flowStatus=approval）"
      stage="approval"
      submitLabel="批准"
      i01DataFn="M03.F06.I01"
      i02DataFn="M03.F06.I02"
    />
  `,
})
// @entry M03.F06.I01 批准队列
// @entry M03.F06.I02 批准按钮（i02DataFn 透传 ReportPhasePage）
export class ReportApprovePageComponent {}
