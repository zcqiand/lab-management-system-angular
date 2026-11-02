// ContractsPage — 薄 wrapper（react src/pages/ContractsPage.tsx 1:1 转写）。
// M02.F01 合同管理 — nextjs ContractsPage 镜像。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ContractsListComponent } from "../features/contracts/contracts-list";

@Component({
  selector: "app-contracts-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ContractsListComponent],
  template: `<app-contracts-list />`,
})
export class ContractsPageComponent {}
