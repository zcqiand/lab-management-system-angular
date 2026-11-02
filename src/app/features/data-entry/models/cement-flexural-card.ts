// 水泥胶砂抗折强度卡：3 试件破坏荷载(kN) → 抗折强度(MPa, Rf=1.5·F·L/b³) → ±10% 剔除均值。
// 移植自 lab-management-system-react/src/features/data-entry/models/CementFlexuralCard.tsx
//（REQ-2026-031 L-T3③）。config：{ specimenCount=3, span=100, width=40 }。
import { ChangeDetectionStrategy, Component, computed } from "@angular/core";

import { computeCementFlexural } from "./cement-strength";
import { ParamCardBase } from "./param-card-base";
import { StrengthCardBaseComponent } from "./strength-card-base";

@Component({
  selector: "app-cement-flexural-card",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StrengthCardBaseComponent],
  template: `
    <app-strength-card-base
      [parameter]="parameter()"
      [record]="record()"
      [sampleId]="sampleId()"
      [standards]="standards()"
      [stdParams]="stdParams()"
      [techReqs]="techReqs()"
      [config]="config()"
      [readOnly]="readOnly()"
      [cardChange]="cardChange()"
      [specimenCount]="specimenCount()"
      [compute]="computeFn"
      [strengthLabel]="STRENGTH_LABEL"
    />
  `,
})
export class CementFlexuralCardComponent extends ParamCardBase {
  private static readonly STRENGTH_LABEL = "抗折强度 (MPa)";

  protected readonly STRENGTH_LABEL = CementFlexuralCardComponent.STRENGTH_LABEL;

  protected readonly specimenCount = computed(() => {
    const cfg = this.config() as { specimenCount?: number } | undefined;
    return cfg?.specimenCount ?? 3;
  });

  protected readonly computeFn = (loads: number[]) => {
    const cfg = this.config() as { span?: number; width?: number } | undefined;
    return computeCementFlexural(loads, cfg?.span ?? 100, cfg?.width ?? 40);
  };
}
