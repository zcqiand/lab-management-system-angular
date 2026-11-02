// ReportNamesPage — 薄 wrapper（react src/pages/ReportNamesPage.tsx 1:1 转写）。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ReportNameListComponent } from "../features/report-names/report-name-list";

@Component({
  selector: "app-report-names-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReportNameListComponent],
  template: `<app-report-name-list />`,
})
export class ReportNamesPageComponent {}
