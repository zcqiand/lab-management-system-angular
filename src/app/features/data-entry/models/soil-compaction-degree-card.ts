// 土工压实度录入卡（soil-compaction-degree）：覆盖 RN-109-2 灌砂法 与 RN-109-3
// 环刀法两份报告——录入列一致，环刀法逐行多一列「最大干密度」（config.showMaxDensityColumn）。
// 移植自 lab-management-system-react/src/features/data-entry/models/SoilCompactionDegreeCard.tsx
//（REQ-2026-031 L-T3③，行为 1:1）。自动：干密度=湿密度/(1+含水率/100)、
// 压实度=干密度/最大干密度×100、单项评定=压实度≥设计压实度。
// 落库形状（109_土工压实度检测报告.inject.json 按此取数）：{ maxDryDensity, rows }。
// @entry M03.F03.I03
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  signal,
} from "@angular/core";

import { ParamCardBase } from "./param-card-base";

export interface CompactionDegreeRow {
  code: string;
  part: string;
  layer: string;
  /** 设计压实度 (%) */
  designDegree: number;
  /** 湿密度 (g/cm³) */
  wetDensity: number;
  /** 含水率 (%) */
  moisture: number;
}

export interface CompactionDegreeComputed extends CompactionDegreeRow {
  /** 干密度 (g/cm³)；无法计算 = 0 */
  dryDensity: number;
  /** 压实度 (%)；无法计算 = 0 */
  degree: number;
  /** 单项评定；缺数据 = '' */
  verdict: "合格" | "不合格" | "";
  /** 该行对应的最大干密度（环刀法逐行显示用） */
  maxDryDensity: number;
}

const DEFAULT_ROW_COUNT = 6;

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

const EMPTY_ROW: CompactionDegreeRow = {
  code: "",
  part: "",
  layer: "",
  designDegree: 0,
  wetDensity: 0,
  moisture: 0,
};

/** 干密度 / 压实度 / 评定。缺任一必需输入 → 该项为 0 / ''。 */
export function computeCompactionDegree(
  row: CompactionDegreeRow,
  maxDryDensity: number,
): { dryDensity: number; degree: number; verdict: "合格" | "不合格" | "" } {
  if (!(row.wetDensity > 0) || !(row.moisture >= 0)) {
    return { dryDensity: 0, degree: 0, verdict: "" };
  }
  const dryDensity = round(row.wetDensity / (1 + row.moisture / 100), 3);
  if (!(maxDryDensity > 0)) return { dryDensity, degree: 0, verdict: "" };
  const degree = round((dryDensity / maxDryDensity) * 100, 1);
  const verdict: "合格" | "不合格" | "" =
    row.designDegree > 0 ? (degree >= row.designDegree ? "合格" : "不合格") : "";
  return { dryDensity, degree, verdict };
}

interface ParsedState {
  maxDryDensity: number;
  rows: CompactionDegreeRow[];
}

function parseResult(raw: string | undefined, count: number): ParsedState {
  const empty = (): ParsedState => ({
    maxDryDensity: 0,
    rows: Array.from({ length: count }, () => ({ ...EMPTY_ROW })),
  });
  if (!raw || !raw.trimStart().startsWith("{")) return empty();
  try {
    const obj = JSON.parse(raw) as {
      maxDryDensity?: number;
      rows?: Array<Partial<CompactionDegreeRow>>;
    };
    const src = Array.isArray(obj.rows) ? obj.rows : [];
    return {
      maxDryDensity: Number(obj.maxDryDensity) || 0,
      rows: Array.from({ length: Math.max(count, src.length) }, (_, i) => ({
        code: String(src[i]?.code ?? ""),
        part: String(src[i]?.part ?? ""),
        layer: String(src[i]?.layer ?? ""),
        designDegree: Number(src[i]?.designDegree) || 0,
        wetDensity: Number(src[i]?.wetDensity) || 0,
        moisture: Number(src[i]?.moisture) || 0,
      })),
    };
  } catch {
    return empty();
  }
}

@Component({
  selector: "app-soil-compaction-degree-card",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card" data-fn="M03.F03.I03">
      <div class="head">
        <span class="name">{{ parameter().canonicalName || parameter().name }}</span>
        <label class="max-label">
          最大干密度（g/cm³）：
          <input
            type="number"
            step="0.001"
            aria-label="最大干密度"
            [disabled]="readOnly()"
            [value]="state().maxDryDensity || ''"
            (input)="updateMax($any($event.target).value)"
          />
        </label>
      </div>

      <table>
        <thead>
          <tr>
            <th>试样编号</th>
            <th>取样部位</th>
            <th>层次</th>
            <th>设计压实度（%）</th>
            <th>湿密度（g/cm³）</th>
            <th>含水率（%）</th>
            <th>干密度（g/cm³）</th>
            @if (showMaxCol()) {
              <th>最大干密度（g/cm³）</th>
            }
            <th>压实度（%）</th>
            <th>单项评定</th>
          </tr>
        </thead>
        <tbody>
          @for (r of computedRows(); track $index; let i = $index) {
            <tr>
              <td>
                <input
                  type="text"
                  [attr.aria-label]="'第 ' + (i + 1) + ' 行试样编号'"
                  [disabled]="readOnly()"
                  [value]="r.code"
                  (input)="updateRow(i, 'code', $any($event.target).value)"
                />
              </td>
              <td>
                <input
                  type="text"
                  [attr.aria-label]="'第 ' + (i + 1) + ' 行取样部位'"
                  [disabled]="readOnly()"
                  [value]="r.part"
                  (input)="updateRow(i, 'part', $any($event.target).value)"
                />
              </td>
              <td>
                <input
                  type="text"
                  [attr.aria-label]="'第 ' + (i + 1) + ' 行层次'"
                  [disabled]="readOnly()"
                  [value]="r.layer"
                  (input)="updateRow(i, 'layer', $any($event.target).value)"
                />
              </td>
              <td>
                <input
                  type="number"
                  step="0.1"
                  [attr.aria-label]="'第 ' + (i + 1) + ' 行设计压实度'"
                  [disabled]="readOnly()"
                  [value]="r.designDegree || ''"
                  (input)="updateRowNum(i, 'designDegree', $any($event.target).value)"
                />
              </td>
              <td>
                <input
                  type="number"
                  step="0.001"
                  [attr.aria-label]="'第 ' + (i + 1) + ' 行湿密度'"
                  [disabled]="readOnly()"
                  [value]="r.wetDensity || ''"
                  (input)="updateRowNum(i, 'wetDensity', $any($event.target).value)"
                />
              </td>
              <td>
                <input
                  type="number"
                  step="0.1"
                  [attr.aria-label]="'第 ' + (i + 1) + ' 行含水率'"
                  [disabled]="readOnly()"
                  [value]="r.moisture || ''"
                  (input)="updateRowNum(i, 'moisture', $any($event.target).value)"
                />
              </td>
              <td [attr.data-testid]="'dry-density-' + i">{{ r.dryDensity || "—" }}</td>
              @if (showMaxCol()) {
                <td>{{ r.maxDryDensity || "—" }}</td>
              }
              <td [attr.data-testid]="'degree-' + i">{{ r.degree || "—" }}</td>
              <td
                [attr.data-testid]="'verdict-' + i"
                [class]="
                  r.verdict === '不合格'
                    ? 'v-fail'
                    : r.verdict === '合格'
                      ? 'v-pass'
                      : 'v-none'
                "
              >
                {{ r.verdict || "—" }}
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
      .max-label {
        font-size: 0.75rem;
        color: #4b5563;
      }
      table {
        font-size: 0.875rem;
        border-collapse: collapse;
      }
      th {
        background: #f9fafb;
        border: 1px solid #d1d5db;
        padding: 0.25rem 0.25rem;
        text-align: center;
        font-weight: 400;
      }
      td {
        border: 1px solid #d1d5db;
        padding: 0.25rem 0.25rem;
        text-align: center;
      }
      input {
        width: 5rem;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.125rem 0.25rem;
        font-size: 0.875rem;
      }
      input:disabled {
        background: #f3f4f6;
        color: #6b7280;
      }
      .v-pass {
        color: #16a34a;
      }
      .v-fail {
        color: #dc2626;
      }
      .v-none {
        color: #9ca3af;
      }
    `,
  ],
})
export class SoilCompactionDegreeCardComponent extends ParamCardBase {
  protected readonly cfg = computed(
    () => (this.config() ?? {}) as { rowCount?: number; showMaxDensityColumn?: boolean },
  );
  protected readonly rowCount = computed(
    () => Number(this.cfg().rowCount) || DEFAULT_ROW_COUNT,
  );
  protected readonly showMaxCol = computed(
    () => this.cfg().showMaxDensityColumn === true,
  );

  protected readonly state = signal<ParsedState>(
    parseResult(undefined, DEFAULT_ROW_COUNT),
  );

  protected readonly computedRows = computed((): CompactionDegreeComputed[] =>
    this.state().rows.map((r) => ({
      ...r,
      ...computeCompactionDegree(r, this.state().maxDryDensity),
      maxDryDensity: this.state().maxDryDensity,
    })),
  );

  constructor() {
    super();
    // 仅切换样品/落库后重置，避免覆盖正在输入的值（react useEffect [sampleId, record?.result, count]）
    effect(() => {
      this.state.set(parseResult(this.record()?.result, this.rowCount()));
    });
  }

  private emit(next: ParsedState): void {
    const rows = next.rows.map((r) => ({
      ...r,
      ...computeCompactionDegree(r, next.maxDryDensity),
      maxDryDensity: next.maxDryDensity,
    }));
    // 整卡评定：任一行不合格即不合格；全部未录入则不上报 verdict（留给人工）
    const filled = rows.filter((r) => r.verdict !== "");
    const overall =
      filled.length === 0
        ? undefined
        : filled.every((r) => r.verdict === "合格")
          ? "合格"
          : "不合格";
    this.cardChange()({
      result: JSON.stringify({ maxDryDensity: next.maxDryDensity, rows }),
      ...(overall ? { verdict: overall } : {}),
    });
  }

  protected updateRow(i: number, field: "code" | "part" | "layer", v: string): void {
    if (this.readOnly()) return;
    const next: ParsedState = {
      ...this.state(),
      rows: this.state().rows.map((r, idx) => (idx === i ? { ...r, [field]: v } : r)),
    };
    this.state.set(next);
    this.emit(next);
  }

  protected updateRowNum(
    i: number,
    field: "designDegree" | "wetDensity" | "moisture",
    raw: string,
  ): void {
    if (this.readOnly()) return;
    const v = raw === "" ? 0 : Number(raw);
    const next: ParsedState = {
      ...this.state(),
      rows: this.state().rows.map((r, idx) =>
        idx === i ? { ...r, [field]: Number.isFinite(v) ? v : 0 } : r,
      ),
    };
    this.state.set(next);
    this.emit(next);
  }

  protected updateMax(raw: string): void {
    if (this.readOnly()) return;
    const v = raw === "" ? 0 : Number(raw);
    const next: ParsedState = {
      ...this.state(),
      maxDryDensity: Number.isFinite(v) ? v : 0,
    };
    this.state.set(next);
    this.emit(next);
  }
}
