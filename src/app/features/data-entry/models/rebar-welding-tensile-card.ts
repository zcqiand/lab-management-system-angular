// 钢筋焊接接头抗拉强度卡（IP-0087）：1 样品 = 3 试件（JGJ/T 27-2014 §6.1）。
// 移植自 lab-management-system-react/src/features/data-entry/models/RebarWeldingTensileCard.tsx
//（REQ-2026-031 L-T3③，行为 1:1）。顶部共享规格 Φ22（硬编码）+ 技术要求；
// Rm = 4000·F/(π·d²)，JGJ/T 27 无 ±10% 剔除，均值=3 试件算术平均。
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  signal,
} from "@angular/core";

import type { TechnicalRequirement } from "../../../../api/endpoints/model/technicalRequirement";
import {
  parseTensileRecord,
  recomputeStrengths,
  meanOfSpecimen,
  REBAR_DIAMETER_MM,
} from "./rebar-welding";
import type { TensileSpecimen } from "./rebar-welding";
import { ParamCardBase } from "./param-card-base";
import { requirementLabel, techReqKey } from "./types";

/** 断裂特征枚举（按 JGJ/T 27-2014 习惯）。 */
const FRACTURE_OPTIONS = ["母材断裂", "焊缝断裂", "热影响区断裂", "其他"];

const MANUAL_VERDICTS = ["合格", "不合格"] as const;

/** 均值 vs 技术要求 → 合格/不合格；无法判定返回 ''。 */
function autoVerdict(
  mean: number | undefined,
  req: TechnicalRequirement | undefined,
): "合格" | "不合格" | "" {
  if (mean === undefined || !req) return "";
  const { comparison, minValue, maxValue, valueType } = req;
  if (comparison === "≥" && minValue != null) return mean >= minValue ? "合格" : "不合格";
  if (comparison === "≤" && maxValue != null) return mean <= maxValue ? "合格" : "不合格";
  if (
    (comparison === "range" || valueType === "range") &&
    minValue != null &&
    maxValue != null
  )
    return mean >= minValue && mean <= maxValue ? "合格" : "不合格";
  return "";
}

@Component({
  selector: "app-rebar-welding-tensile-card",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="head">
        <span class="name">
          {{ parameter().canonicalName || parameter().name
          }}{{ parameter().unit ? "（" + parameter().unit + "）" : "" }}
          <span class="sub">3 试件 / JGJ/T 27-2014</span>
        </span>
        <span class="verdict-wrap">
          @if (verdict(); as v) {
            <span [class]="verdictClass()">{{ v }}</span>
          } @else {
            <select
              [value]="record()?.verdict ?? ''"
              (change)="cardChange()({ verdict: $any($event.target).value })"
              [disabled]="readOnly()"
              aria-label="整体单项评定"
            >
              <option value="">未评定</option>
              @for (v of manualVerdicts; track v) {
                <option [value]="v">{{ v }}</option>
              }
            </select>
          }
        </span>
      </div>

      <div class="share-bar">
        <span class="muted" aria-label="公称直径（硬编码）">
          规格 Φ{{ DIAMETER }}
          <span class="sub">（硬编码，不录入）</span>
        </span>
        <span class="muted">
          技术要求
          <select
            [value]="spec().techReqId"
            (change)="updateReq($any($event.target).value)"
            [disabled]="readOnly()"
            aria-label="技术要求"
          >
            <option value="">未选</option>
            @for (r of reqOptions(); track techReqKey(r)) {
              <option [value]="techReqKey(r)">{{ requirementLabel(r) }}</option>
            }
          </select>
        </span>
      </div>

      <table>
        <thead>
          <tr>
            <th class="w6">#</th>
            <th>最大荷重 (kN)</th>
            <th>抗拉强度 (MPa)</th>
            <th>断口距 (mm)</th>
            <th>断裂特征</th>
          </tr>
        </thead>
        <tbody>
          @for (t of trials; track t) {
            <tr>
              <td>{{ t + 1 }}</td>
              <td>
                <input
                  type="number"
                  step="0.01"
                  placeholder="kN"
                  [value]="spec().loads[t] === 0 ? '' : spec().loads[t]"
                  (input)="updateLoad(t, $any($event.target).value)"
                  [readOnly]="readOnly()"
                  [attr.aria-label]="'试件 ' + (t + 1) + ' 最大荷重'"
                />
              </td>
              <td class="strength">
                {{ spec().strengths[t] > 0 ? spec().strengths[t].toFixed(1) : "-" }}
              </td>
              <td>
                <input
                  type="number"
                  step="0.1"
                  placeholder="mm"
                  [value]="
                    spec().fractureDistances[t] === 0 ? '' : spec().fractureDistances[t]
                  "
                  (input)="updateDistance(t, $any($event.target).value)"
                  [readOnly]="readOnly()"
                  [attr.aria-label]="'试件 ' + (t + 1) + ' 断口距'"
                />
              </td>
              <td>
                <select
                  (change)="updateFracture(t, $any($event.target).value)"
                  [disabled]="readOnly()"
                  [attr.aria-label]="'试件 ' + (t + 1) + ' 断裂特征'"
                >
                  <option value="">未选</option>
                  @for (opt of fractureOptions; track opt) {
                    <option
                      [value]="opt"
                      [selected]="spec().fractureCharacteristics[t] === opt"
                    >
                      {{ opt }}
                    </option>
                  }
                </select>
              </td>
            </tr>
          }
        </tbody>
      </table>

      <div class="mean-line">
        均值：<span class="mean">{{ mean() ?? "—" }}</span>
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
        gap: 0.75rem;
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
      .sub {
        font-size: 0.75rem;
        color: #9ca3af;
      }
      .share-bar {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.75rem;
        background: #f8fafc;
        border-radius: 0.25rem;
        padding: 0.5rem;
      }
      .muted {
        color: #6b7280;
      }
      table {
        width: 100%;
        font-size: 0.75rem;
        border-collapse: collapse;
      }
      th {
        color: #6b7280;
        font-weight: 400;
        text-align: left;
      }
      th,
      td {
        padding: 0.25rem 0;
      }
      input {
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.25rem 0.375rem;
        font-size: 0.875rem;
      }
      input[readonly] {
        background: #f9fafb;
        color: #6b7280;
      }
      select {
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.25rem;
        font-size: 0.875rem;
        background: #ffffff;
      }
      select:disabled {
        background: #f9fafb;
        color: #6b7280;
      }
      .strength {
        color: #374151;
      }
      .mean-line {
        font-size: 0.75rem;
        color: #4b5563;
      }
      .mean {
        font-weight: 500;
        color: #111827;
      }
      .verdict-wrap select {
        margin-left: 0.25rem;
      }
    `,
  ],
})
export class RebarWeldingTensileCardComponent extends ParamCardBase {
  protected readonly DIAMETER = REBAR_DIAMETER_MM;
  protected readonly trials: readonly (0 | 1 | 2)[] = [0, 1, 2];
  protected readonly fractureOptions = FRACTURE_OPTIONS;
  protected readonly manualVerdicts = MANUAL_VERDICTS;
  protected readonly techReqKey = techReqKey;
  protected readonly requirementLabel = requirementLabel;

  protected readonly spec = signal<TensileSpecimen>(parseTensileRecord(undefined));

  /** 仅取已核验的技术要求。 */
  protected readonly reqOptions = computed(() =>
    this.techReqs().filter((r) => r.verificationStatus === "verified"),
  );

  protected readonly mean = computed(() => meanOfSpecimen(this.spec()));

  protected readonly req = computed(
    () =>
      this.reqOptions().find((r) => techReqKey(r) === this.spec().techReqId) ??
      this.reqOptions()[0],
  );

  protected readonly verdict = computed(() => autoVerdict(this.mean(), this.req()));

  protected readonly verdictClass = computed(() =>
    this.verdict() === "合格"
      ? "text-green-600"
      : this.verdict() === "不合格"
        ? "text-red-600"
        : "text-gray-400",
  );

  constructor() {
    super();
    // 切换样品时重置本地状态（react useEffect [sampleId, record?.result]）
    effect(() => {
      this.spec.set(parseTensileRecord(this.record()?.result));
    });
  }

  private update(patch: Partial<TensileSpecimen>): void {
    if (this.readOnly()) return;
    const next = recomputeStrengths({ ...this.spec(), ...patch });
    this.spec.set(next);
    this.cardChange()({ result: JSON.stringify(next) });
  }

  protected updateLoad(t: 0 | 1 | 2, raw: string): void {
    const v = raw === "" ? 0 : Number(raw);
    const loads = [...this.spec().loads] as [number, number, number];
    loads[t] = Number.isFinite(v) ? v : 0;
    this.update({ loads });
  }

  protected updateDistance(t: 0 | 1 | 2, raw: string): void {
    const v = raw === "" ? 0 : Number(raw);
    const fractureDistances = [...this.spec().fractureDistances] as [
      number,
      number,
      number,
    ];
    fractureDistances[t] = Number.isFinite(v) ? v : 0;
    this.update({ fractureDistances });
  }

  protected updateFracture(t: 0 | 1 | 2, v: string): void {
    const fractureCharacteristics = [...this.spec().fractureCharacteristics] as [
      string,
      string,
      string,
    ];
    fractureCharacteristics[t] = v;
    this.update({ fractureCharacteristics });
  }

  protected updateReq(reqId: string): void {
    const r = this.reqOptions().find((x) => techReqKey(x) === reqId);
    this.update({
      techReqId: reqId,
      techReqLabel: r ? requirementLabel(r) : "",
    });
  }
}
