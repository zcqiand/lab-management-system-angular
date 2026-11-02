// DataEntryPage — 薄 wrapper（react src/pages/DataEntryPage.tsx 1:1 转写）。
// M03.F03 数据录入 — 流程线第三环节。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { DataEntryComponent } from "../features/data-entry/data-entry";

@Component({
  selector: "app-data-entry-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataEntryComponent],
  template: `<app-data-entry />`,
})
export class DataEntryPageComponent {}
