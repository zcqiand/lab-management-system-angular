// 水泥胶砂抗压强度卡：6 试件破坏荷载(kN) → 抗压强度(MPa, Rc=F/A) → ±10% 剔除均值。
// 移植自 lab-management-system-react/src/features/data-entry/models/CementCompressCard.tsx
//（REQ-2026-031 L-T3③）。config：{ specimenCount=6, area=1600 }。
import { ChangeDetectionStrategy, Component, computed } from "@angular/core";

import { computeCementCompress } from "./cement-strength";
import { ParamCardBase } from "./param-card-base";
import { StrengthCardBaseComponent } from "./strength-card-base";

@Component({
  selector: "app-cement-compress-card",
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
export class CementCompressCardComponent extends ParamCardBase {
  private static readonly STRENGTH_LABEL = "抗压强度 (MPa)";

  protected readonly STRENGTH_LABEL = CementCompressCardComponent.STRENGTH_LABEL;

  protected readonly specimenCount = computed(() => {
    const cfg = this.config() as { specimenCount?: number } | undefined;
    return cfg?.specimenCount ?? 6;
  });

  protected readonly computeFn = (loads: number[]) => {
    const cfg = this.config() as { area?: number } | undefined;
    return computeCementCompress(loads, cfg?.area ?? 1600);
  };
}
