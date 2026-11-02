// 钢筋焊接接头弯曲性能卡（IP-0155）：1 样品 = 3 试件（JGJ/T 27-2014 §6.2）。
// 移植自 lab-management-system-react/src/features/data-entry/models/RebarWeldingBendCard.tsx
//（REQ-2026-031 L-T3③，行为 1:1）。3 行 = 弯曲角度(deg) + 合格/不合格；
// 整体评定：3 件全合格 → 合格；任一不合格 → 不合格；其余 → 手选。
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  signal,
} from "@angular/core";

import { parseBendRecord } from "./rebar-welding";
import type { BendSpecimen } from "./rebar-welding";
import { ParamCardBase } from "./param-card-base";

/** 弯曲试验结果枚举（JGJ/T 27-2014 习惯）。 */
const BEND_RESULTS = ["合格", "不合格"] as const;

@Component({
  selector: "app-rebar-welding-bend-card",
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
          @if (overall(); as o) {
            <span [class]="overallClass()">{{ o }}</span>
          } @else {
            <select
              [value]="record()?.verdict ?? ''"
              (change)="cardChange()({ verdict: $any($event.target).value })"
              [disabled]="readOnly()"
              aria-label="整体单项评定"
            >
              <option value="">未评定</option>
              @for (v of bendResults; track v) {
                <option [value]="v">{{ v }}</option>
              }
            </select>
          }
        </span>
      </div>

      <table>
        <thead>
          <tr>
            <th class="w6">#</th>
            <th>弯曲角度 (°)</th>
            <th>弯曲结果</th>
          </tr>
        </thead>
        <tbody>
          @for (t of trials; track t) {
            <tr>
              <td>{{ t + 1 }}</td>
              <td>
                <input
                  type="number"
                  step="1"
                  placeholder="90"
                  [value]="spec().angles[t] === 0 ? '' : spec().angles[t]"
                  (input)="updateAngle(t, $any($event.target).value)"
                  [readOnly]="readOnly()"
                  [attr.aria-label]="'试件 ' + (t + 1) + ' 弯曲角度'"
                />
              </td>
              <td>
                <select
                  (change)="updateResult(t, $any($event.target).value)"
                  [disabled]="readOnly()"
                  [attr.aria-label]="'试件 ' + (t + 1) + ' 弯曲结果'"
                >
                  @for (opt of bendResults; track opt) {
                    <option [value]="opt" [selected]="spec().results[t] === opt">
                      {{ opt }}
                    </option>
                  }
                </select>
              </td>
            </tr>
          }
        </tbody>
      </table>
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
      .verdict-wrap select {
        margin-left: 0.25rem;
      }
    `,
  ],
})
export class RebarWeldingBendCardComponent extends ParamCardBase {
  protected readonly trials: readonly (0 | 1 | 2)[] = [0, 1, 2];
  protected readonly bendResults = BEND_RESULTS;

  protected readonly spec = signal<BendSpecimen>(parseBendRecord(undefined));

  // 整体评定：3 件全合格 → 合格；任一不合格 → 不合格；其余 → ''
  protected readonly overall = computed((): "合格" | "不合格" | "" => {
    const results = this.spec().results;
    if (results.some((r) => r === "不合格")) return "不合格";
    if (results.every((r) => r === "合格")) return "合格";
    return "";
  });

  protected readonly overallClass = computed(() =>
    this.overall() === "合格"
      ? "text-green-600"
      : this.overall() === "不合格"
        ? "text-red-600"
        : "text-gray-400",
  );

  constructor() {
    super();
    // 切换样品时重置（react useEffect [sampleId, record?.result]）
    effect(() => {
      this.spec.set(parseBendRecord(this.record()?.result));
    });
  }

  private update(patch: Partial<BendSpecimen>): void {
    if (this.readOnly()) return;
    const next = { ...this.spec(), ...patch } as BendSpecimen;
    this.spec.set(next);
    // 自动判覆盖手选；无自动判时不动 record.verdict（让用户在 record 顶层手选）
    this.cardChange()({
      result: JSON.stringify(next),
      ...(this.overall() ? { verdict: this.overall() } : {}),
    });
  }

  protected updateAngle(t: 0 | 1 | 2, raw: string): void {
    const v = raw === "" ? 0 : Number(raw);
    const angles = [...this.spec().angles] as [number, number, number];
    angles[t] = Number.isFinite(v) ? v : 0;
    this.update({ angles });
  }

  protected updateResult(t: 0 | 1 | 2, v: string): void {
    const results = [...this.spec().results] as [string, string, string];
    results[t] = v;
    this.update({ results });
  }
}
