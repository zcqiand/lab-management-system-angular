// ReceiptsPage — 薄 wrapper（react src/pages/ReceiptsPage.tsx 1:1 转写）。
// M03.F01 接样管理 — 流程线第一环节。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ReceiptsListComponent } from "../features/receipts/receipts-list";

@Component({
  selector: "app-receipts-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReceiptsListComponent],
  template: `<app-receipts-list />`,
})
export class ReceiptsPageComponent {}
