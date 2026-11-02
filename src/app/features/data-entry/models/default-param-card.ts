// M03.F03 通用参数卡（registry 白名单之外的兜底）。
// 移植自 lab-management-system-react/src/features/data-entry/models/DefaultParamCard.tsx
//（REQ-2026-031 L-T3③ 归入 ParamCardBase 九键契约；字段 4 个 1:1：检测依据/技术要求/
// 检测结果/单项评定；EntryModal 传 standards/stdParams/techReqs = []，两下拉空壳占位）。
import { ChangeDetectionStrategy, Component, computed } from "@angular/core";

import type { InspectionStandard } from "../../../../api/endpoints/model/inspectionStandard";
import { ParamCardBase } from "./param-card-base";
import { requirementLabel, techReqKey } from "./types";
import type { ParamCardPatch } from "./types";

const VERDICT_OPTIONS = ["合格", "不合格", "符合", "不符合"] as const;

@Component({
  selector: "app-default-param-card",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="head">
        <span class="name">
          {{ parameter().canonicalName || parameter().name
          }}{{ parameter().unit ? "（" + parameter().unit + "）" : "" }}
        </span>
      </div>
      <div class="grid">
        <div>
          <label>检测依据</label>
          <select
            [value]="record()?.standardCode ?? ''"
            (change)="emitChange({ standardCode: $any($event.target).value })"
            [disabled]="readOnly()"
          >
            <option value="">—</option>
            @for (s of basisOptions(); track s.code) {
              <option [value]="s.code">{{ s.code }} {{ s.name }}</option>
            }
          </select>
        </div>
        <div>
          <label>技术要求</label>
          <select
            [value]="record()?.requirementCode ?? ''"
            (change)="onReqChange($any($event.target).value)"
            [disabled]="readOnly()"
          >
            <option value="">—</option>
            @for (r of reqOptions(); track techReqKey(r)) {
              <option [value]="techReqKey(r)">{{ requirementLabel(r) }}</option>
            }
          </select>
        </div>
        <div>
          <label>检测结果</label>
          <input
            type="text"
            [value]="record()?.result ?? ''"
            (input)="emitChange({ result: $any($event.target).value })"
            placeholder="录入检测结果"
            [readonly]="readOnly()"
          />
        </div>
        <div>
          <label>单项评定</label>
          <select
            [value]="record()?.verdict ?? ''"
            (change)="emitChange({ verdict: $any($event.target).value })"
            [disabled]="readOnly()"
          >
            <option value="">未评定</option>
            @for (v of verdictOptions; track v) {
              <option [value]="v">{{ v }}</option>
            }
          </select>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .card {
        border: 1px solid #e2e8f0;
        border-radius: 0.25rem;
        padding: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .name {
        font-size: 0.875rem;
        font-weight: 500;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        column-gap: 0.75rem;
        row-gap: 0.25rem;
        font-size: 0.75rem;
      }
      label {
        display: block;
        color: #64748b;
        margin-bottom: 0.125rem;
      }
      select,
      input {
        width: 100%;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.25rem 0.375rem;
        font-size: 0.875rem;
        background: #ffffff;
      }
    `,
  ],
})
export class DefaultParamCardComponent extends ParamCardBase {
  protected readonly verdictOptions = VERDICT_OPTIONS;
  protected readonly techReqKey = techReqKey;
  protected readonly requirementLabel = requirementLabel;

  protected readonly basisOptions = computed(() => {
    const p = this.parameter();
    const stdParams = this.stdParams();
    const standards = this.standards();
    return stdParams
      .filter((sp) => sp.inspectionParameterCode === p.code)
      .map((sp) => standards.find((s) => s.code === sp.inspectionStandardCode))
      .filter((s): s is InspectionStandard => Boolean(s));
  });

  protected readonly reqOptions = computed(() => {
    const p = this.parameter();
    return this.techReqs().filter((r) => r.inspectionParameterCode === p.code);
  });

  protected onReqChange(value: string): void {
    const found = this.reqOptions().find((r) => techReqKey(r) === value);
    this.emitChange({
      requirementCode: value,
      requirement: found ? requirementLabel(found) : "",
    });
  }

  protected emitChange(patch: ParamCardPatch): void {
    this.cardChange()(patch);
  }
}
