// 土工击实录入卡（soil-compaction）：GB/T 50123-2019 击实试验。
// 移植自 lab-management-system-react/src/features/data-entry/models/SoilCompactionCard.tsx
//（REQ-2026-031 L-T3③，行为 1:1）。N 组（含水率%, 干密度 g/cm³）→ 曲线峰值 =
// 最大干密度 / 最优含水率；≥3 有效点做三点二次拟合取顶点（退化回退实测峰值）。
// 落库形状（109_土工击实检测报告.inject.json 按此取数）：
// { points, maxDryDensity, optimalMoisture }。
// @entry M03.F03.I03
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  signal,
} from "@angular/core";

import { ParamCardBase } from "./param-card-base";

export interface CompactionPoint {
  /** 含水率 (%)；0 = 未填 */
  moisture: number;
  /** 干密度 (g/cm³)；0 = 未填 */
  dryDensity: number;
}

export interface CompactionResult {
  points: CompactionPoint[];
  maxDryDensity: number | undefined;
  optimalMoisture: number | undefined;
}

const DEFAULT_POINT_COUNT = 5;

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/**
 * 击实曲线峰值。
 *
 * ≥3 个有效点时对峰值点及其左右邻点做二次拟合取顶点（标准做法，避免把
 * 离散实测点的最大值直接当峰值）；拟合退化（开口向上或分母为 0）或点数不足时
 * 回退到实测最大干密度点。
 */
export function computeCompactionPeak(points: CompactionPoint[]): {
  maxDryDensity: number | undefined;
  optimalMoisture: number | undefined;
} {
  const valid = points.filter((p) => p.dryDensity > 0 && p.moisture > 0);
  if (valid.length === 0) return { maxDryDensity: undefined, optimalMoisture: undefined };

  const sorted = [...valid].sort((a, b) => a.moisture - b.moisture);
  let peakIdx = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.dryDensity > sorted[peakIdx]!.dryDensity) peakIdx = i;
  }
  const peak = sorted[peakIdx]!;
  const fallback = {
    maxDryDensity: round(peak.dryDensity, 3),
    optimalMoisture: round(peak.moisture, 1),
  };

  // 峰值在端点或点数不足 → 无法三点拟合
  if (sorted.length < 3 || peakIdx === 0 || peakIdx === sorted.length - 1)
    return fallback;

  const [p1, p2, p3] = [sorted[peakIdx - 1]!, peak, sorted[peakIdx + 1]!];
  const [x1, y1] = [p1.moisture, p1.dryDensity];
  const [x2, y2] = [p2.moisture, p2.dryDensity];
  const [x3, y3] = [p3.moisture, p3.dryDensity];
  const denom = (x1 - x2) * (x1 - x3) * (x2 - x3);
  if (denom === 0) return fallback;

  const a = (x3 * (y2 - y1) + x2 * (y1 - y3) + x1 * (y3 - y2)) / denom;
  // a >= 0 → 开口向上/退化为直线，没有极大值
  if (a >= 0) return fallback;
  const b = (x3 * x3 * (y1 - y2) + x2 * x2 * (y3 - y1) + x1 * x1 * (y2 - y3)) / denom;
  const c =
    (x2 * x3 * (x2 - x3) * y1 + x3 * x1 * (x3 - x1) * y2 + x1 * x2 * (x1 - x2) * y3) /
    denom;
  const vertexX = -b / (2 * a);
  const vertexY = a * vertexX * vertexX + b * vertexX + c;

  // 拟合顶点必须落在三点区间内且不低于实测峰值，否则不可信 → 回退
  if (vertexX < x1 || vertexX > x3 || vertexY < peak.dryDensity) return fallback;
  return { maxDryDensity: round(vertexY, 3), optimalMoisture: round(vertexX, 1) };
}

function parseResult(raw: string | undefined, count: number): CompactionPoint[] {
  const empty = () =>
    Array.from({ length: count }, () => ({ moisture: 0, dryDensity: 0 }));
  if (!raw || !raw.trimStart().startsWith("{")) return empty();
  try {
    const obj = JSON.parse(raw) as { points?: Array<Partial<CompactionPoint>> };
    if (!Array.isArray(obj.points)) return empty();
    return Array.from({ length: count }, (_, i) => ({
      moisture: Number(obj.points?.[i]?.moisture) || 0,
      dryDensity: Number(obj.points?.[i]?.dryDensity) || 0,
    }));
  } catch {
    return empty();
  }
}

@Component({
  selector: "app-soil-compaction-card",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card" data-fn="M03.F03.I03">
      <div class="head">
        <span class="name">{{ parameter().canonicalName || parameter().name }}</span>
        <span class="sub">GB/T 50123-2019 击实试验</span>
      </div>

      <table>
        <thead>
          <tr>
            <th>序号</th>
            @for (p of points(); track $index; let i = $index) {
              <th>{{ i + 1 }}</th>
            }
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>含水率（%）</td>
            @for (p of points(); track $index; let i = $index) {
              <td>
                <input
                  type="number"
                  step="0.1"
                  [attr.aria-label]="'第 ' + (i + 1) + ' 组含水率'"
                  [disabled]="readOnly()"
                  [value]="p.moisture || ''"
                  (input)="update(i, 'moisture', $any($event.target).value)"
                />
              </td>
            }
          </tr>
          <tr>
            <td>干密度（g/cm³）</td>
            @for (p of points(); track $index; let i = $index) {
              <td>
                <input
                  type="number"
                  step="0.001"
                  [attr.aria-label]="'第 ' + (i + 1) + ' 组干密度'"
                  [disabled]="readOnly()"
                  [value]="p.dryDensity || ''"
                  (input)="update(i, 'dryDensity', $any($event.target).value)"
                />
              </td>
            }
          </tr>
        </tbody>
      </table>

      <div class="peak-line">
        <span>
          最大干密度（g/cm³）：
          <b data-testid="max-dry-density">{{ peak().maxDryDensity ?? "—" }}</b>
        </span>
        <span>
          最优含水率（%）：
          <b data-testid="optimal-moisture">{{ peak().optimalMoisture ?? "—" }}</b>
        </span>
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
      table {
        font-size: 0.875rem;
        border-collapse: collapse;
      }
      th {
        background: #f9fafb;
        border: 1px solid #d1d5db;
        padding: 0.25rem 0.5rem;
        text-align: center;
        font-weight: 400;
      }
      td {
        border: 1px solid #d1d5db;
        padding: 0.25rem 0.5rem;
        text-align: center;
      }
      input {
        width: 5rem;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.125rem 0.25rem;
        font-size: 0.875rem;
        text-align: right;
      }
      input:disabled {
        background: #f3f4f6;
        color: #6b7280;
      }
      .peak-line {
        display: flex;
        gap: 1.5rem;
        font-size: 0.875rem;
      }
    `,
  ],
})
export class SoilCompactionCardComponent extends ParamCardBase {
  protected readonly count = computed(() => {
    const cfg = this.config() as { pointCount?: number } | undefined;
    return Number(cfg?.pointCount) || DEFAULT_POINT_COUNT;
  });

  protected readonly points = signal<CompactionPoint[]>([]);

  protected readonly peak = computed(() => computeCompactionPeak(this.points()));

  constructor() {
    super();
    // 仅切换样品/落库后重置，避免覆盖正在输入的值（react useEffect [sampleId, record?.result, count]）
    effect(() => {
      this.points.set(parseResult(this.record()?.result, this.count()));
    });
  }

  protected update(i: number, field: keyof CompactionPoint, raw: string): void {
    if (this.readOnly()) return;
    const v = raw === "" ? 0 : Number(raw);
    const next = this.points().map((p, idx) =>
      idx === i ? { ...p, [field]: Number.isFinite(v) ? v : 0 } : p,
    );
    this.points.set(next);
    const { maxDryDensity, optimalMoisture } = computeCompactionPeak(next);
    const result: CompactionResult = { points: next, maxDryDensity, optimalMoisture };
    this.cardChange()({ result: JSON.stringify(result) });
  }
}
