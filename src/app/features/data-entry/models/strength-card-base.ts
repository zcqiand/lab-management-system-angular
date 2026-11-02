// 水泥胶砂强度卡基类（抗折/抗压共用，M03.F03）。
// 移植自 lab-management-system-react/src/features/data-entry/models/StrengthCardBase.tsx
//（REQ-2026-031 L-T3③，行为 1:1）：N 试件 × 破坏荷载(kN) → 只读强度(MPa) →
// ±10% 剔除均值 → 单项评定。有 verified 技术要求时按均值自动判；否则回退手选。
// react useEffect（loads 按 sampleId/record.result/specimenCount 重置）→ angular effect。
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
} from "@angular/core";

import { autoVerdict, parseStrengthRecord } from "./cement-strength";
import type { StrengthResult } from "./cement-strength";
import { ParamCardBase } from "./param-card-base";
import { requirementLabel, techReqKey } from "./types";

const MANUAL_VERDICTS = ["合格", "不合格"] as const;

@Component({
  selector: "app-strength-card-base",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="head">
        <span class="name">
          {{ parameter().canonicalName || parameter().name
          }}{{ parameter().unit ? "（" + parameter().unit + "）" : "" }}
        </span>
        <span
          class="verdict"
          [class.v-pass]="verdict() === '合格'"
          [class.v-fail]="verdict() === '不合格'"
          >{{ verdict() || "未评定" }}</span
        >
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>破坏荷载 (kN)</th>
            <th>{{ strengthLabel() }}</th>
          </tr>
        </thead>
        <tbody>
          @for (lv of loads(); track $index; let i = $index) {
            <tr>
              <td>{{ i + 1 }}</td>
              <td>
                <input
                  type="number"
                  step="0.01"
                  placeholder="破坏荷载 (kN)"
                  [value]="lv === 0 ? '' : lv"
                  (input)="onLoadInput(i, $any($event.target).value)"
                  [readOnly]="readOnly()"
                  [attr.aria-label]="'试件 ' + (i + 1) + ' 破坏荷载'"
                />
              </td>
              <td [class.strike]="lv > 0 && !res().kept[i]">
                {{ lv > 0 ? res().strengths[i] : "-" }}
              </td>
            </tr>
          }
        </tbody>
      </table>
      <div class="mean-line">
        强度平均值：<span class="mean">{{ res().mean ?? "—" }}</span>
        @if (res().invalid) {
          <span class="invalid-note"> （离群值超 ±10%，按 GB/T 17671 结果作废） </span>
        }
      </div>
      @if (reqOptions().length > 0) {
        <div class="req-line">
          <label>技术要求</label>
          <select
            [value]="reqId()"
            (change)="onReqChange($any($event.target).value)"
            [disabled]="readOnly()"
          >
            @for (r of reqOptions(); track techReqKey(r)) {
              <option [value]="techReqKey(r)">{{ requirementLabel(r) }}</option>
            }
          </select>
        </div>
      } @else {
        <div class="req-line">
          <label>单项评定</label>
          <select
            [value]="record()?.verdict ?? ''"
            (change)="onManualVerdict($any($event.target).value)"
            [disabled]="readOnly()"
          >
            <option value="">未评定</option>
            @for (v of manualVerdicts; track v) {
              <option [value]="v">{{ v }}</option>
            }
          </select>
        </div>
      }
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
      .verdict {
        font-size: 0.75rem;
        color: #9ca3af;
      }
      .verdict.v-pass {
        color: #16a34a;
      }
      .verdict.v-fail {
        color: #dc2626;
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
        width: 8rem;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.25rem 0.5rem;
        font-size: 0.875rem;
      }
      input[readonly] {
        background: #f9fafb;
        color: #6b7280;
      }
      .strike {
        color: #9ca3af;
        text-decoration: line-through;
      }
      .mean-line {
        font-size: 0.75rem;
        color: #4b5563;
      }
      .mean {
        font-weight: 500;
        color: #111827;
      }
      .invalid-note {
        margin-left: 0.5rem;
        color: #ef4444;
      }
      .req-line {
        font-size: 0.75rem;
      }
      .req-line label {
        color: #6b7280;
        margin-right: 0.25rem;
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
    `,
  ],
})
export class StrengthCardBaseComponent extends ParamCardBase {
  /** 试件数（抗折 3 / 抗压 6）。 */
  readonly specimenCount = input.required<number>();
  /** 荷载(kN) → StrengthResult 的计算函数（含 ±10% 剔除）。 */
  readonly compute = input.required<(loads: number[]) => StrengthResult>();
  /** 强度列表头，如「抗折强度 (MPa)」。 */
  readonly strengthLabel = input.required<string>();

  protected readonly manualVerdicts = MANUAL_VERDICTS;
  protected readonly techReqKey = techReqKey;
  protected readonly requirementLabel = requirementLabel;

  protected readonly loads = signal<number[]>([]);
  protected readonly reqId = signal("");
  private readonly reqInitialized = signal(false);

  /** 仅取已核验的技术要求参与自动判；无则回退手选。 */
  protected readonly reqOptions = computed(() =>
    this.techReqs().filter((r) => r.verificationStatus === "verified"),
  );

  protected readonly res = computed(() => this.compute()(this.loads()));

  protected readonly selectedReq = computed(() =>
    this.reqOptions().find((r) => techReqKey(r) === this.reqId()),
  );

  protected readonly verdict = computed(() => {
    const opts = this.reqOptions();
    if (opts.length > 0) {
      return autoVerdict(this.res().mean, this.selectedReq() ?? opts[0]);
    }
    return this.record()?.verdict ?? "";
  });

  constructor() {
    super();
    // 切换样品或落库（record.result 变）时重置本地荷载，避免跨样品污染。
    effect(() => {
      const count = this.specimenCount();
      const initial = parseStrengthRecord(this.record()?.result);
      this.loads.set(Array.from({ length: count }, (_, i) => initial.loads[i] ?? 0));
    });
    // react useState 初值等价：inputs 就绪后置一次 reqId（落库值优先，否则首个 verified 要求）
    effect(() => {
      if (this.reqInitialized()) return;
      const first = this.reqOptions()[0];
      const initial = this.record()?.requirementCode ?? (first ? techReqKey(first) : "");
      this.reqId.set(initial);
      this.reqInitialized.set(true);
    });
  }

  protected onLoadInput(i: number, raw: string): void {
    if (this.readOnly()) return;
    const v = raw === "" ? 0 : Number(raw);
    const next = [...this.loads()];
    next[i] = Number.isFinite(v) ? v : 0;
    this.loads.set(next);
    this.emit(next, this.reqId());
  }

  protected onReqChange(value: string): void {
    if (this.readOnly()) return;
    this.reqId.set(value);
    this.emit(this.loads(), value);
  }

  protected onManualVerdict(value: string): void {
    if (this.readOnly()) return;
    this.emit(this.loads(), this.reqId(), value);
  }

  private emit(nextLoads: number[], nextReqId: string, manualVerdict?: string): void {
    const res = this.compute()(nextLoads);
    const req =
      this.reqOptions().find((r) => techReqKey(r) === nextReqId) ?? this.reqOptions()[0];
    const patch = {
      result: JSON.stringify({
        loads: nextLoads,
        strengths: res.strengths,
        kept: res.kept,
        mean: res.mean,
        invalid: res.invalid,
      }),
    };
    if (this.reqOptions().length > 0) {
      this.cardChange()({
        ...patch,
        verdict: autoVerdict(res.mean, req),
        requirementCode: nextReqId,
        requirement: req ? requirementLabel(req) : "",
      });
    } else if (manualVerdict !== undefined) {
      this.cardChange()({ ...patch, verdict: manualVerdict });
    } else {
      this.cardChange()(patch);
    }
  }
}
