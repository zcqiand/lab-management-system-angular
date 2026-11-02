// ReportArchivePage — 薄 wrapper（react src/pages/ReportArchivePage.tsx 1:1 转写）。
// M03.F08 报告归档 — 流程线第七环节。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ReportPhasePageComponent } from "../features/reports/report-phase-page";

@Component({
  selector: "app-report-archive-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReportPhasePageComponent],
  template: `
    <app-report-phase-page
      title="报告归档"
      subtitle="归档完成后进入已完成（flowStatus=archived）"
      stage="archived"
      submitLabel="归档完成"
      i01DataFn="M03.F08.I01"
      i02DataFn="M03.F08.I02"
    />
  `,
})
// @entry M03.F08.I01 归档队列
// @entry M03.F08.I02 归档完成按钮（i02DataFn 透传 ReportPhasePage）
export class ReportArchivePageComponent {}
