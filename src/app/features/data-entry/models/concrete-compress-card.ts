// 混凝土抗压强度模型卡：N 试件 × 破坏荷载 → 只读抗压强度 → 代表值=均值。
// 移植自 lab-management-system-react/src/features/data-entry/models/ConcreteCompressCard.tsx
//（REQ-2026-031 L-T3③，行为 1:1）。无技术要求/单项评定（按代表值评定，不在此卡判定）。
// config：{ specimenCount=3, area=22500 }。
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  signal,
} from "@angular/core";

import { ParamCardBase } from "./param-card-base";

/** 荷载(kN) + 受压面积(mm²) → 抗压强度(MPa) + 代表值(均值)，均保留 2 位。 */
export function computeConcreteCompress(
  loads: number[],
  area: number,
): { strengths: number[]; representative: number | undefined } {
  const strengths = loads
    .filter((v) => v !== null && !Number.isNaN(v))
    .map((v) => Math.round(((v * 1000) / area) * 100) / 100);
  if (strengths.length === 0) return { strengths: [], representative: undefined };
  const mean = strengths.reduce((a, b) => a + b, 0) / strengths.length;
  return { strengths, representative: Math.round(mean * 100) / 100 };
}

export function parseRecordResult(raw: string | undefined): {
  loads: number[];
  strengths: number[];
  representative?: number;
} {
  if (!raw) return { loads: [], strengths: [] };
  try {
    const obj = JSON.parse(raw) as {
      loads?: number[];
      strengths?: number[];
      representative?: number;
    };
    return {
      loads: Array.isArray(obj.loads) ? obj.loads : [],
      strengths: Array.isArray(obj.strengths) ? obj.strengths : [],
      representative: obj.representative,
    };
  } catch {
    return { loads: [], strengths: [] };
  }
}

@Component({
  selector: "app-concrete-compress-card",
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
            <th>破坏荷载 (kN)</th>
            <th>抗压强度 (MPa)</th>
          </tr>
        </thead>
        <tbody>
          @for (lv of loads(); track $index; let i = $index) {
            <tr>
              <td>{{ i + 1 }}</td>
              <td>
                <input
                  type="number"
                  placeholder="破坏荷载 (kN)"
                  [value]="lv === 0 ? '' : lv"
                  (input)="onLoadInput(i, $any($event.target).value)"
                  [readOnly]="readOnly()"
                />
              </td>
              <td>{{ lv ? strength(i) : "-" }}</td>
            </tr>
          }
        </tbody>
      </table>
      <div class="mean-line">抗压强度代表值：{{ representative() ?? "—" }}</div>
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
      .mean-line {
        font-size: 0.75rem;
        color: #4b5563;
      }
    `,
  ],
})
export class ConcreteCompressCardComponent extends ParamCardBase {
  protected readonly loads = signal<number[]>([]);

  private readonly area = computed(() => {
    const cfg = this.config() as { area?: number } | undefined;
    return cfg?.area ?? 22500;
  });

  protected readonly specimenCount = computed(() => {
    const cfg = this.config() as { specimenCount?: number } | undefined;
    return cfg?.specimenCount ?? 3;
  });

  protected readonly representative = computed(
    () => computeConcreteCompress(this.loads(), this.area()).representative,
  );

  constructor() {
    super();
    // 切换样品或落库时重置本地荷载，避免跨样品污染（react useEffect [sampleId, record?.result, specimenCount]）
    effect(() => {
      const count = this.specimenCount();
      const initial = parseRecordResult(this.record()?.result);
      this.loads.set(Array.from({ length: count }, (_, i) => initial.loads[i] ?? 0));
    });
  }

  protected strength(i: number): number | null {
    const lv = this.loads()[i];
    if (!lv) return null;
    return Math.round(((lv * 1000) / this.area()) * 100) / 100;
  }

  protected onLoadInput(i: number, raw: string): void {
    if (this.readOnly()) return;
    const v = raw === "" ? 0 : Number(raw);
    const next = [...this.loads()];
    next[i] = v;
    this.loads.set(next);
    const { strengths: s, representative: rep } = computeConcreteCompress(
      next,
      this.area(),
    );
    this.cardChange()({
      result: JSON.stringify({ loads: next, strengths: s, representative: rep }),
    });
  }
}
