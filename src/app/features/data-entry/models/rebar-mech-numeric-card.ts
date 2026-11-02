// 钢筋力学性能 / 机械连接 通用多组数值卡（rebar-mech-numeric）。
// 移植自 lab-management-system-react/src/features/data-entry/models/RebarMechNumericCard.tsx
//（REQ-2026-031 L-T3③，行为 1:1）。组数 calcRule.specimenCount（回退 config → 2），
// 行为由 config.formulaKey 决定：tensile/yield → R=4000·F/(π·d²)；
// passthrough → 直接录入；ratio_* → 跨记录联立（缺值回退手动）。
// 注：calcRule / crossRecord 为本卡本地扩展 input（ParamCardBase 九键之外，
// EntryDialog 现阶段不传，与 react EntryModal 同形状）。
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
} from "@angular/core";

import type { TechnicalRequirement } from "../../../../api/endpoints/model/technicalRequirement";
import { ParamCardBase } from "./param-card-base";
import { autoVerdict } from "./cement-strength";
import { requirementLabel, techReqKey } from "./types";
import type { CalcRuleRef, CrossRecordInput, ParamCardPatch } from "./types";
import {
  parseRebarMechResult,
  computeStrengths,
  ratioTensileOverYield,
  ratioMeasuredOverSpec,
  meanOf,
  rounderFor,
} from "./rebar-mechanics";
import type { RebarMechResult, RebarMechFormula } from "./rebar-mechanics";

const MANUAL_VERDICTS = ["合格", "不合格"] as const;

interface NumericConfig {
  formulaKey?: RebarMechFormula;
  specimenCount?: number;
  needsDiameter?: boolean;
  inputLabel?: string;
  /** 机械连接模式：每试件录入「断裂位置」下拉，存到 result.fractureLocations[N] */
  connectionMode?: boolean;
  fractureLocationOptions?: string[];
}

@Component({
  selector: "app-rebar-mech-numeric-card",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="head">
        <span class="name">
          {{ parameter().canonicalName || parameter().name
          }}{{ parameter().unit ? "（" + parameter().unit + "）" : "" }}
          <span class="sub">
            {{ count() }} 组{{
              isRatio() ? (autoMode() ? " / 自动计算" : " / 手动录入") : ""
            }}
          </span>
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
        @if (needsDiameter()) {
          <span class="muted">
            直径 d (mm)
            <input
              type="number"
              step="0.1"
              placeholder="直径"
              [value]="
                state().diameter === 0 || state().diameter === undefined
                  ? ''
                  : state().diameter
              "
              (input)="updateDiameter($any($event.target).value)"
              [readOnly]="readOnly()"
              aria-label="公称直径"
            />
          </span>
        }
        <span class="muted">
          技术要求
          <select
            [value]="state().techReqId"
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
            @if (showInputCol()) {
              <th>{{ inputLabel() }}</th>
            }
            @if (isStrength()) {
              <th>强度 (MPa)</th>
            }
            @if (isRatio()) {
              <th>比值</th>
            }
            @if (connectionMode()) {
              <th>断裂位置</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (i of rows(); track i) {
            <tr>
              <td>{{ i + 1 }}</td>
              @if (showInputCol()) {
                <td>
                  <input
                    type="number"
                    step="0.01"
                    [placeholder]="inputLabel()"
                    [value]="(state().loads[i] ?? 0) === 0 ? '' : state().loads[i]"
                    (input)="updateLoad(i, $any($event.target).value)"
                    [readOnly]="readOnly()"
                    [attr.aria-label]="'第 ' + (i + 1) + ' 组 ' + inputLabel()"
                  />
                </td>
              }
              @if (isStrength()) {
                <td class="val">
                  {{ strengths()[i] > 0 ? strengths()[i].toFixed(1) : "-" }}
                </td>
              }
              @if (isRatio() && autoMode()) {
                <td class="val">
                  {{ strengths()[i] > 0 ? strengths()[i].toFixed(2) : "-" }}
                </td>
              }
              @if (connectionMode()) {
                <td>
                  <select
                    (change)="updateFractureLocation(i, $any($event.target).value)"
                    [disabled]="readOnly()"
                    [attr.aria-label]="'第 ' + (i + 1) + ' 试件断裂位置'"
                  >
                    <option value="">—</option>
                    @for (opt of fractureLocationOptions(); track opt) {
                      <option
                        [value]="opt"
                        [selected]="(state().fractureLocations?.[i] ?? '') === opt"
                      >
                        {{ opt }}
                      </option>
                    }
                  </select>
                </td>
              }
            </tr>
          }
        </tbody>
      </table>

      <div class="mean-line">
        均值：<span class="mean">{{ mean() ?? "—" }}</span>
        @if (isStrength() && (state().diameter ?? 0) <= 0) {
          <span class="hint">（需填公称直径以计算强度）</span>
        }
        @if (isRatio() && !autoMode()) {
          <span class="hint">（同样品抗拉/屈服未录入，暂手动填写比值）</span>
        }
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
      .val {
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
      .hint {
        margin-left: 0.5rem;
        color: #f97316;
      }
      .verdict-wrap select {
        margin-left: 0.25rem;
      }
    `,
  ],
})
export class RebarMechNumericCardComponent extends ParamCardBase {
  /** 本卡扩展：组数规则（EntryDialog 未传时回退 config → 2）。 */
  readonly calcRule = input<CalcRuleRef | undefined>(undefined);

  /** 本卡扩展：同样品跨记录联立数据（比值卡自动模式）。 */
  readonly crossRecord = input<CrossRecordInput | undefined>(undefined);

  protected readonly manualVerdicts = MANUAL_VERDICTS;
  protected readonly techReqKey = techReqKey;
  protected readonly requirementLabel = requirementLabel;
  protected readonly rows = computed(() =>
    Array.from({ length: this.count() }, (_, i) => i),
  );

  protected readonly cfg = computed(() => (this.config() ?? {}) as NumericConfig);
  protected readonly formula = computed(
    (): RebarMechFormula => this.cfg().formulaKey ?? "passthrough",
  );
  protected readonly count = computed(
    () => this.cfg().specimenCount ?? this.calcRule()?.specimenCount ?? 2,
  );
  protected readonly needsDiameter = computed(() => !!this.cfg().needsDiameter);
  protected readonly inputLabel = computed(() => this.cfg().inputLabel ?? "数值");
  protected readonly connectionMode = computed(() => !!this.cfg().connectionMode);
  protected readonly fractureLocationOptions = computed(
    () =>
      this.cfg().fractureLocationOptions ?? [
        "母材断裂",
        "断于接头",
        "热影响区断裂",
        "其他",
      ],
  );
  protected readonly round = computed(() => rounderFor(this.formula()));
  protected readonly isStrength = computed(
    () => this.formula() === "tensile_strength" || this.formula() === "yield_strength",
  );
  protected readonly isRatio = computed(
    () =>
      this.formula() === "ratio_tensile_over_yield" ||
      this.formula() === "ratio_measured_over_spec_yield",
  );
  /** 输入列可见性（react：isStrength || (!isRatio && !isStrength) || manualRatio）。 */
  protected readonly showInputCol = computed(
    () => this.isStrength() || !this.isRatio() || !this.autoMode(),
  );

  protected readonly state = signal<RebarMechResult>(parseRebarMechResult(undefined, 2));

  /** 仅取已核验的技术要求。 */
  protected readonly reqOptions = computed(() =>
    this.techReqs().filter((r) => r.verificationStatus === "verified"),
  );

  protected readonly req = computed(
    () =>
      this.reqOptions().find((r) => techReqKey(r) === this.state().techReqId) ??
      this.reqOptions()[0],
  );

  // 比值卡的自动联立值；缺跨记录数据 → null（回退手动录入）
  protected readonly autoStrengths = computed((): number[] | null => {
    const f = this.formula();
    const cross = this.crossRecord();
    const count = this.count();
    if (f === "ratio_tensile_over_yield") {
      const t = cross?.tensileStrengths;
      const y = cross?.yieldStrengths;
      if (t && y && t.some((v) => v > 0) && y.some((v) => v > 0))
        return ratioTensileOverYield(t, y, count);
    }
    if (f === "ratio_measured_over_spec_yield") {
      const y = cross?.yieldStrengths;
      const spec = cross?.specStandardYield;
      if (y && spec && spec > 0 && y.some((v) => v > 0))
        return ratioMeasuredOverSpec(y, spec, count);
    }
    return null;
  });

  protected readonly autoMode = computed(() => this.autoStrengths() !== null);

  // 有效结果数组：强度=载荷+直径算；比值自动=联立；其余=录入值本身
  protected readonly strengths = computed((): number[] => {
    if (this.isStrength())
      return computeStrengths(this.state().loads, this.state().diameter ?? 0);
    if (this.autoMode()) return this.autoStrengths() as number[];
    const round = this.round();
    const count = this.count();
    return this.state()
      .loads.slice(0, count)
      .map((v) => (Number.isFinite(v) && v > 0 ? round(v) : 0));
  });

  protected readonly mean = computed(() => meanOf(this.strengths(), this.round()));

  protected readonly verdict = computed(() => autoVerdict(this.mean(), this.req()));

  protected readonly verdictClass = computed(() =>
    this.verdict() === "合格"
      ? "text-green-600"
      : this.verdict() === "不合格"
        ? "text-red-600"
        : "text-gray-400",
  );

  /** 自动比值去重键（react lastAuto ref）。 */
  private lastAuto = "";

  constructor() {
    super();
    // 切换样品/组数变化时重置（react useEffect [sampleId, record?.result, count]）
    effect(() => {
      const count = this.count();
      this.state.set(parseRebarMechResult(this.record()?.result, count));
    });
    // 自动比值：联立结果变化时把结果落进 dirty 缓冲（序列化 dep 防重复触发）
    effect(() => {
      const auto = this.autoStrengths();
      const autoMode = this.autoMode();
      const readOnly = this.readOnly();
      if (readOnly || !autoMode || auto === null) return;
      const autoKey = JSON.stringify(auto);
      if (this.lastAuto === autoKey) return;
      this.lastAuto = autoKey;
      this.emitState(this.state(), auto);
    });
  }

  private emitState(next: RebarMechResult, nextStrengths: number[]): void {
    const result: RebarMechResult = {
      ...next,
      strengths: nextStrengths,
      mean: meanOf(nextStrengths, this.round()),
    };
    const v = autoVerdict(result.mean, this.req());
    const patch: ParamCardPatch = {
      result: JSON.stringify(result),
      ...(v ? { verdict: v } : {}),
    };
    this.cardChange()(patch);
  }

  protected updateDiameter(raw: string): void {
    if (this.readOnly()) return;
    const v = raw === "" ? 0 : Number(raw);
    const next = { ...this.state(), diameter: Number.isFinite(v) ? v : 0 };
    this.state.set(next);
    this.emitState(next, computeStrengths(next.loads, next.diameter ?? 0));
  }

  protected updateLoad(i: number, raw: string): void {
    if (this.readOnly() || this.autoMode()) return;
    const v = raw === "" ? 0 : Number(raw);
    const loads = [...this.state().loads];
    loads[i] = Number.isFinite(v) ? v : 0;
    const next = { ...this.state(), loads };
    const round = this.round();
    const count = this.count();
    const ns = this.isStrength()
      ? computeStrengths(loads, next.diameter ?? 0)
      : loads.slice(0, count).map((x) => (Number.isFinite(x) && x > 0 ? round(x) : 0));
    this.state.set(next);
    this.emitState(next, ns);
  }

  protected updateReq(reqId: string): void {
    if (this.readOnly()) return;
    const r = this.reqOptions().find((x) => techReqKey(x) === reqId);
    const next = {
      ...this.state(),
      techReqId: reqId,
      techReqLabel: r ? requirementLabel(r) : "",
    };
    this.state.set(next);
    this.emitState(next, this.strengths());
  }

  protected updateFractureLocation(i: number, value: string): void {
    if (this.readOnly()) return;
    const count = this.count();
    const nextLocs = Array.from(
      { length: count },
      (_, j) => this.state().fractureLocations?.[j] ?? "",
    );
    nextLocs[i] = value;
    const next = { ...this.state(), fractureLocations: nextLocs };
    this.state.set(next);
    this.emitState(next, this.strengths());
  }
}
