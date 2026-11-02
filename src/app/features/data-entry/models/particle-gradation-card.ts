// 颗粒级配录入卡（particle-gradation）：砂 / 碎（卵）石 颗粒级配表
//（GB/T 14684 / GB/T 14685）。
// 移植自 lab-management-system-react/src/features/data-entry/models/ParticleGradationCard.tsx
//（REQ-2026-031 L-T3③，行为 1:1）。每样品 3 子行（筛余量(g) / 分计筛余(%) / 累计筛余(%)），
// 自动算：累计筛余=累加、细度模数=前 6 孔累计筛余和/(100−筛底)、平均=各样品分计筛余均值。
// 落库形状含派生列（cumulativePct / finenessModulus / average）——报告模板直接取数。
// @entry M03.F03.I03 颗粒级配录入卡。
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  signal,
} from "@angular/core";

import { ParamCardBase } from "./param-card-base";

const SIEVE_COLS_SAND = [
  "4.75mm",
  "2.36mm",
  "1.18mm",
  "0.60mm",
  "0.30mm",
  "0.15mm",
  "筛底",
];
const SIEVE_COLS_GRAVEL = [
  "90mm",
  "75mm",
  "63mm",
  "53mm",
  "37.5mm",
  "31.5mm",
  "26.5mm",
  "19mm",
  "16mm",
  "9.5mm",
  "4.75mm",
  "2.36mm",
];

interface Row {
  retainedPct: number[]; // 长度 = sieveCols.length
  totalBefore: number;
  totalAfter: number;
}

interface ParsedResult {
  rows: Row[];
  sieveCount: number;
}

function emptyRow(sieveCount: number): Row {
  return {
    retainedPct: Array.from({ length: sieveCount }, () => 0),
    totalBefore: 0,
    totalAfter: 0,
  };
}

function parseResult(raw: string | undefined, fallbackSieveCount: number): ParsedResult {
  if (!raw) return { rows: [], sieveCount: fallbackSieveCount };
  try {
    const obj = JSON.parse(raw) as { rows?: Row[]; sieveCount?: number };
    if (Array.isArray(obj.rows)) {
      // 标准化每行 retainedPct 长度
      const rows = obj.rows.map((r) => {
        const arr = Array.isArray(r.retainedPct) ? [...r.retainedPct] : [];
        while (arr.length < fallbackSieveCount) arr.push(0);
        return {
          retainedPct: arr.slice(0, fallbackSieveCount),
          totalBefore: r.totalBefore ?? 0,
          totalAfter: r.totalAfter ?? 0,
        };
      });
      return { rows, sieveCount: obj.sieveCount ?? fallbackSieveCount };
    }
  } catch {
    /* fall through */
  }
  return { rows: [], sieveCount: fallbackSieveCount };
}

export function computeCumulative(retainedPct: number[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const v of retainedPct) {
    acc += Number(v) || 0;
    out.push(Math.round(acc * 100) / 100);
  }
  return out;
}

export function computeFinenessModulus(
  cumulativePct: number[],
  sieveCount: number,
): number {
  // GB/T 14684 砂：前 6 个累计筛余之和 / (100 − 筛底累计筛余)
  const topSix = cumulativePct.slice(0, Math.min(6, sieveCount - 1));
  const sum = topSix.reduce((a, b) => a + b, 0);
  const bottom = cumulativePct[sieveCount - 1] ?? 0;
  if (bottom >= 100) return 0;
  return Math.round((sum / (100 - bottom)) * 100) / 100;
}

export function averageByCol(rows: Row[]): number[] {
  if (rows.length === 0) return [];
  const len = rows[0]!.retainedPct.length;
  const out: number[] = [];
  for (let c = 0; c < len; c++) {
    let s = 0;
    let n = 0;
    for (const r of rows) {
      const v = Number(r.retainedPct[c]);
      if (Number.isFinite(v) && v > 0) {
        s += v;
        n++;
      }
    }
    out.push(n > 0 ? Math.round((s / n) * 10) / 10 : 0);
  }
  return out;
}

@Component({
  selector: "app-particle-gradation-card",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card" data-fn="M03.F03.I03">
      <div class="head">
        <span class="name">
          颗 粒 级 配{{ parameter().unit ? "（" + parameter().unit + "）" : "" }}
        </span>
      </div>

      <table>
        <thead>
          <tr>
            <th class="w6">序号</th>
            <th class="w20">项目</th>
            @for (s of sieveCols(); track s) {
              <th class="center">{{ s }}</th>
            }
            <th class="left w32">分筛前总量(g):</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track $index; let ri = $index) {
            @if (rowComputed()[ri]; as rc) {
              <tr>
                <td class="center idx" [attr.rowspan]="3">{{ ri + 1 }}</td>
                <td>筛余量(g):</td>
                @for (pct of row.retainedPct; track $index) {
                  <td class="center muted-grams">
                    {{ pct === 0 ? "" : gramOf(row, pct) }}
                  </td>
                }
                <td class="center">
                  <input
                    type="number"
                    step="1"
                    [attr.aria-label]="'第 ' + (ri + 1) + ' 行 分筛前总量'"
                    [value]="row.totalBefore === 0 ? '' : row.totalBefore"
                    (input)="onTotalInput(ri, 'totalBefore', $any($event.target).value)"
                    (blur)="emit()"
                    [readOnly]="readOnly()"
                  />
                </td>
              </tr>
              <tr>
                <td>分计筛余量(%):</td>
                @for (pct of row.retainedPct; track $index; let ci = $index) {
                  <td class="center">
                    <input
                      type="number"
                      step="0.1"
                      [attr.aria-label]="
                        '第 ' + (ri + 1) + ' 行 ' + sieveCols()[ci] + ' 分计筛余'
                      "
                      [value]="pct === 0 ? '' : pct"
                      (input)="onPctInput(ri, ci, $any($event.target).value)"
                      (blur)="emit()"
                      [readOnly]="readOnly()"
                    />
                  </td>
                }
                <td class="center">
                  分筛后总量(g):&nbsp;
                  <input
                    type="number"
                    step="1"
                    [attr.aria-label]="'第 ' + (ri + 1) + ' 行 分筛后总量'"
                    [value]="row.totalAfter === 0 ? '' : row.totalAfter"
                    (input)="onTotalInput(ri, 'totalAfter', $any($event.target).value)"
                    (blur)="emit()"
                    [readOnly]="readOnly()"
                  />
                  @if (rc.delta !== 0) {
                    <span class="delta">Δ{{ rc.delta }}</span>
                  }
                </td>
              </tr>
              <tr>
                <td>累计筛余量(%):</td>
                @for (c of rc.cum; track $index) {
                  <td class="center cum">{{ c === 0 ? "" : c }}</td>
                }
                <td class="center">
                  细&nbsp;度&nbsp;模&nbsp;数:&nbsp;
                  <span class="mono">{{ rc.fm === 0 ? "—" : rc.fm }}</span>
                </td>
              </tr>
            }
          }
          <tr class="avg-row">
            <td></td>
            <td>平均值(%):</td>
            @for (v of avg(); track $index) {
              <td class="center">{{ v === 0 ? "—" : v }}</td>
            }
            <td></td>
          </tr>
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
        color: #dc2626;
      }
      table {
        width: 100%;
        font-size: 0.75rem;
        border-collapse: collapse;
        border: 1px solid #d1d5db;
      }
      th {
        background: #eff6ff;
        color: #374151;
        font-weight: 400;
        border: 1px solid #d1d5db;
        padding: 0.25rem 0.5rem;
      }
      td {
        border: 1px solid #d1d5db;
        padding: 0.25rem 0.25rem;
      }
      .center {
        text-align: center;
      }
      .left {
        text-align: left;
      }
      .w6 {
        width: 1.5rem;
      }
      .w20 {
        width: 5rem;
      }
      .w32 {
        width: 8rem;
      }
      .idx {
        font-weight: 500;
      }
      input {
        width: 4.5rem;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.125rem 0.25rem;
        font-size: 0.75rem;
        text-align: center;
      }
      input[readonly] {
        background: #f9fafb;
        color: #6b7280;
      }
      .muted-grams {
        color: #6b7280;
      }
      .cum {
        color: #404040;
      }
      .mono {
        font-family: ui-monospace, monospace;
      }
      .delta {
        margin-left: 0.25rem;
        font-size: 0.625rem;
        color: #f97316;
      }
      .avg-row {
        background: #f9fafb;
        font-weight: 500;
      }
    `,
  ],
})
export class ParticleGradationCardComponent extends ParamCardBase {
  protected readonly cfg = computed(
    () =>
      (this.config() ?? {}) as {
        sieveCount?: number;
        sampleRows?: number;
        gravel?: boolean;
      },
  );
  protected readonly sieveCols = computed(() =>
    this.cfg().gravel ? SIEVE_COLS_GRAVEL : SIEVE_COLS_SAND,
  );
  protected readonly sampleRows = computed(() => this.cfg().sampleRows ?? 2);

  protected readonly rows = signal<Row[]>([]);

  // 每行的累计筛余 + 细度模数 + 分筛前后差值
  protected readonly rowComputed = computed(() =>
    this.rows().map((r) => {
      const cum = computeCumulative(r.retainedPct);
      const fm = computeFinenessModulus(cum, this.sieveCols().length);
      return { cum, fm, delta: r.totalAfter > 0 ? r.totalBefore - r.totalAfter : 0 };
    }),
  );

  protected readonly avg = computed(() => averageByCol(this.rows()));

  constructor() {
    super();
    // 切换样品/落库时重置（react useEffect [sampleId, record?.result, sieveCount, sampleRows]）
    effect(() => {
      const sieveCount = this.sieveCols().length;
      const parsed = parseResult(this.record()?.result, sieveCount);
      if (parsed.rows.length > 0) {
        this.rows.set(parsed.rows);
      } else {
        this.rows.set(
          Array.from({ length: this.sampleRows() }, () => emptyRow(sieveCount)),
        );
      }
    });
  }

  protected gramOf(row: Row, pct: number): number {
    const total = row.totalBefore > 0 ? row.totalBefore : 1;
    return Math.round((pct * total) / 100);
  }

  protected onPctInput(ri: number, ci: number, raw: string): void {
    if (this.readOnly()) return;
    const v = raw === "" ? 0 : Number(raw);
    this.rows.update((prev) =>
      prev.map((r, i) => {
        if (i !== ri) return r;
        const retainedPct = [...r.retainedPct];
        retainedPct[ci] = Number.isFinite(v) ? v : 0;
        return { ...r, retainedPct };
      }),
    );
  }

  protected onTotalInput(
    ri: number,
    field: "totalBefore" | "totalAfter",
    raw: string,
  ): void {
    if (this.readOnly()) return;
    const v = raw === "" ? 0 : Number(raw);
    this.rows.update((prev) =>
      prev.map((r, i) => (i === ri ? { ...r, [field]: Number.isFinite(v) ? v : 0 } : r)),
    );
  }

  // 落库形状必须包含派生列：报告模板通过
  //   record:IP-0577:rows[i].cumulativePct[j] / rows[i].finenessModulus / average[j]
  // 直接取数（见 data/templates/103_*.inject.json）。累计筛余与细度模数只在渲染时算、
  // 不落库的话，砂/碎（卵）石四份报告的级配表会整片渲染成「—」。
  // 注意：react emit 零参（挂在 onBlur 上防事件对象误传）——angular 模板 (blur)="emit()" 同形状。
  protected emit(): void {
    const sieveCount = this.sieveCols().length;
    const persistedRows = this.rows().map((r) => {
      const cumulativePct = computeCumulative(r.retainedPct);
      return {
        ...r,
        cumulativePct,
        finenessModulus: computeFinenessModulus(cumulativePct, sieveCount),
      };
    });
    const result = JSON.stringify({
      rows: persistedRows,
      sieveCount,
      average: averageByCol(this.rows()),
    });
    this.cardChange()({ result });
  }
}
