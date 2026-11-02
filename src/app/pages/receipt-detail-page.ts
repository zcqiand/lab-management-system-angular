// ReceiptDetailPage — 薄 wrapper（react src/pages/ReceiptDetailPage.tsx 1:1 转写）。
// M03.F09 接样单详情 — 路由 /receipts/:id，id 由 ActivatedRoute 提供。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ReceiptDetailComponent } from "../features/receipts/receipt-detail";

@Component({
  selector: "app-receipt-detail-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReceiptDetailComponent],
  template: `<app-receipt-detail />`,
})
export class ReceiptDetailPageComponent {}
