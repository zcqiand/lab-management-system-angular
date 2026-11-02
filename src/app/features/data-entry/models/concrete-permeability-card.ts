// 混凝土抗渗性能模型卡：6 试件 ×（渗水压力 MPa + 渗水情况）→ 抗渗等级。
// 移植自 lab-management-system-react/src/features/data-entry/models/ConcretePermeabilityCard.tsx
//（REQ-2026-031 L-T3③，行为 1:1，GB/T 50082-2009：第 3 个渗水试件压力=抗渗等级）。
// 不在卡内判定合格/不合格（由技术要求列 + 人工改判决定）。
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  signal,
} from "@angular/core";

import { ParamCardBase } from "./param-card-base";

/** 试件数（混凝土抗渗标准为 6 个圆台试件）。 */
const SPECIMEN_COUNT = 6;

/** 渗水情况枚举。 */
export type Permeation = "已渗" | "未渗";

export interface Specimen {
  pressure: number; // MPa；0 = 未填
  permeated: Permeation;
}

const EMPTY_SPECIMEN: Specimen = { pressure: 0, permeated: "未渗" };

/**
 * 按 GB/T 50082-2009 计算抗渗等级：
 * 6 个试件中第 3 个渗水试件的渗水压力 = 抗渗等级（MPa 数值）。
 * 不足 3 个渗水 → grade=undefined。
 */
export function computeConcretePermeability(specimens: Specimen[]): {
  grade: number | undefined;
  gradeLabel: string;
  reason: string | undefined;
} {
  const permeatedPressures: number[] = [];
  for (const s of specimens) {
    if (s.permeated === "已渗" && s.pressure > 0) permeatedPressures.push(s.pressure);
  }
  if (permeatedPressures.length >= 3) {
    // 取第 3 个渗水试件的压力为抗渗等级
    const grade = permeatedPressures[2]!;
    return {
      grade,
      gradeLabel: `P${Math.round(grade * 10)}`,
      reason: undefined,
    };
  }
  if (permeatedPressures.length === 0) {
    // 全部未渗：取 6 个试件中的最大试验压力作为「未达到」的上界
    const maxPressure = specimens.reduce((m, s) => Math.max(m, s.pressure), 0);
    if (maxPressure > 0) {
      return {
        grade: undefined,
        gradeLabel: `未达到 P${Math.round(maxPressure * 10)}`,
        reason: "已渗试件 < 3，按国标记为未达到",
      };
    }
    return { grade: undefined, gradeLabel: "—", reason: "尚未录入" };
  }
  // 1 或 2 个渗水：未达到
  return {
    grade: undefined,
    gradeLabel: `未达到 P${permeatedPressures.length >= 1 ? Math.round(permeatedPressures[permeatedPressures.length - 1]! * 10) : "n"}`,
    reason: "已渗试件 < 3，按国标记为未达到",
  };
}

export function parseRecordResult(raw: string | undefined): Specimen[] {
  if (!raw) return Array.from({ length: SPECIMEN_COUNT }, () => ({ ...EMPTY_SPECIMEN }));
  try {
    const obj = JSON.parse(raw) as {
      specimens?: Array<{ pressure?: number; permeated?: Permeation }>;
    };
    const list = obj.specimens;
    if (!Array.isArray(list))
      return Array.from({ length: SPECIMEN_COUNT }, () => ({ ...EMPTY_SPECIMEN }));
    return Array.from({ length: SPECIMEN_COUNT }, (_, i) => {
      const s = list[i];
      return {
        pressure: typeof s?.pressure === "number" ? s.pressure : 0,
        permeated: s?.permeated === "已渗" ? "已渗" : "未渗",
      };
    });
  } catch {
    return Array.from({ length: SPECIMEN_COUNT }, () => ({ ...EMPTY_SPECIMEN }));
  }
}

@Component({
  selector: "app-concrete-permeability-card",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="name">
        {{ parameter().canonicalName || parameter().name
        }}{{ parameter().unit ? "（" + parameter().unit + "）" : "" }}
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>渗水压力 (MPa)</th>
            <th>渗水情况</th>
          </tr>
        </thead>
        <tbody>
          @for (s of specimens(); track $index; let i = $index) {
            <tr>
              <td>{{ i + 1 }}</td>
              <td>
                <input
                  type="number"
                  step="0.1"
                  placeholder="渗水压力 (MPa)"
                  [value]="s.pressure === 0 ? '' : s.pressure"
                  (input)="onPressureInput(i, $any($event.target).value)"
                  [readOnly]="readOnly()"
                  [attr.aria-label]="'试件 ' + (i + 1) + ' 渗水压力'"
                />
              </td>
              <td>
                <select
                  (change)="onPermeatedChange(i, $any($event.target).value)"
                  [disabled]="readOnly()"
                  [attr.aria-label]="'试件 ' + (i + 1) + ' 渗水情况'"
                >
                  <option value="未渗" [selected]="s.permeated === '未渗'">未渗</option>
                  <option value="已渗" [selected]="s.permeated === '已渗'">已渗</option>
                </select>
              </td>
            </tr>
          }
        </tbody>
      </table>
      <div class="grade-line">
        抗渗等级：<span class="grade">{{ gradeLabel() }}</span>
        @if (reason(); as r) {
          <span class="reason">（{{ r }}）</span>
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
        gap: 0.5rem;
      }
      .name {
        font-size: 0.875rem;
        font-weight: 500;
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
      select {
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.25rem 0.5rem;
        font-size: 0.875rem;
        background: #ffffff;
      }
      select:disabled {
        background: #f9fafb;
        color: #6b7280;
      }
      .grade-line {
        font-size: 0.75rem;
        color: #4b5563;
      }
      .grade {
        font-weight: 500;
        color: #111827;
      }
      .reason {
        margin-left: 0.5rem;
        color: #94a3b8;
      }
    `,
  ],
})
export class ConcretePermeabilityCardComponent extends ParamCardBase {
  protected readonly specimens = signal<Specimen[]>(
    Array.from({ length: SPECIMEN_COUNT }, () => ({ ...EMPTY_SPECIMEN })),
  );

  protected readonly gradeLabel = computed(
    () => computeConcretePermeability(this.specimens()).gradeLabel,
  );

  protected readonly reason = computed(
    () => computeConcretePermeability(this.specimens()).reason,
  );

  constructor() {
    super();
    // 切换样品或落库时重置 specimens，避免跨样品污染（react useEffect [sampleId, record?.result]）
    effect(() => {
      this.specimens.set(parseRecordResult(this.record()?.result));
    });
  }

  protected onPressureInput(i: number, raw: string): void {
    const v = raw === "" ? 0 : Number(raw);
    this.update(i, { pressure: Number.isFinite(v) ? v : 0 });
  }

  protected onPermeatedChange(i: number, v: string): void {
    this.update(i, { permeated: v === "已渗" ? "已渗" : "未渗" });
  }

  private update(i: number, patch: Partial<Specimen>): void {
    if (this.readOnly()) return;
    const next = this.specimens().map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    this.specimens.set(next);
    this.emit(next);
  }

  private emit(next: Specimen[]): void {
    // gradeLabel 必须落库：105_混凝土抗渗性能检测报告 的「判定」列通过
    // srecord:<n>:IP-0190:gradeLabel 取数（P8 / 未达到 P8），只存 grade 数值取不到该文案。
    const { grade, gradeLabel, reason } = computeConcretePermeability(next);
    this.cardChange()({
      result: JSON.stringify({
        specimens: next,
        grade,
        gradeLabel,
        reason: grade === undefined ? reason : undefined,
      }),
    });
  }
}
