// M05.F01 报告汇总 + 仪表盘统计 — /summary 与 /dashboard 共用页面。
// 移植自 lab-management-system-react/src/features/summary/SummaryList.tsx
//（REQ-2026-031 L-T4，行为 1:1；radix Select → 原生 select，
// shadcn Card/Badge → 语义等价 span/div，toast 缺省同 react 无提示）。
//
// - GET /api/summary（categoryCode 过滤）+ GET /api/summary/stats 并行取数
// - 汇总表动态列（后端 columns 穿透；flowStatus/result 两列特殊渲染）
// - I02 统计五卡（合同/接样/样品/待办/按状态分布）
// - I03 核心指标三卡（今日试验/报告产出/合格率，REQ-2026-017 镜像 nextjs）
// - I04 六段任务状态漏斗（水平条 + 段计数 + 合计）
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { PageLoadingComponent } from "../../ui/page-loading.component";
import { EmptyStateComponent } from "../../ui/empty-state.component";
import { SummaryService } from "../../../api/endpoints/summary/summary.service";
import { compactParams } from "../../../api/params";
import type { SummaryData } from "../../../api/endpoints/model/summaryData";
import type { DashboardStats } from "../../../api/endpoints/model/dashboardStats";
import type { DashboardStatsFunnelByStage } from "../../../api/endpoints/model/dashboardStatsFunnelByStage";

/** flowStatus → 中文标签（表内 Badge 文本，react STATUS_LABEL 1:1）。 */
const STATUS_LABEL: Record<string, string> = {
  receiving: "接样",
  task_assignment: "任务分配",
  data_entry: "数据录入",
  review: "审核",
  approval: "批准",
  issuance: "发放",
  archived: "归档",
  completed: "已完成",
};

/** REQ-2026-017 I03/I04：与 nextjs SummaryPage 同款常量（key 顺序即漏斗段序）。 */
const FUNNEL_LABELS: Array<{
  key: keyof DashboardStatsFunnelByStage;
  label: string;
}> = [
  { key: "pending_collect", label: "待取样" },
  { key: "received", label: "已收样" },
  { key: "testing", label: "试验中" },
  { key: "reporting", label: "报告编制" },
  { key: "reviewing", label: "待审核" },
  { key: "issued", label: "已签发" },
];

const MATERIAL_LABELS: Array<{
  key: "concrete" | "rebar" | "sand";
  label: string;
}> = [
  { key: "concrete", label: "混凝土" },
  { key: "rebar", label: "钢筋" },
  { key: "sand", label: "砂石" },
];

/** 合格率小数 → "97.5%" 形状。 */
function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

@Component({
  selector: "app-summary-list",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PageLoadingComponent, EmptyStateComponent],
  template: `
    @if (loading() && !data() && !error()) {
      <app-page-loading />
    } @else {
      <div class="stack" data-fn="M05.F01.I01">
        <div class="card">
          <h2>报告汇总</h2>
          <p class="desc">M05.F01 报告汇总表（按报告类别 categoryCode 过滤）</p>

          <div class="filter-row">
            <div>
              <label for="categoryCode">报告类别</label>
              <select
                id="categoryCode"
                name="categoryCode"
                [ngModel]="categoryCode()"
                (ngModelChange)="categoryCode.set($event); load()"
              >
                <option value="ALL">全部</option>
                <option value="RC">建材检测（RC）</option>
                <option value="ST">主体结构（ST）</option>
                <option value="MT">钢结构（MT）</option>
                <option value="AD">建筑节能（AD）</option>
                <option value="ID">室内环境（ID）</option>
              </select>
            </div>
          </div>

          @if (error(); as err) {
            <div role="alert" class="error-bar">{{ err }}</div>
          }

          @if (!loading() && data(); as d) {
            @if (d.rows.length === 0) {
              <app-empty-state title="暂无报告" descriptionText="该类别下还没有接样单" />
            } @else {
              <table>
                <thead>
                  <tr>
                    @for (c of d.columns; track c.key) {
                      <th>{{ c.label }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (row of d.rows; track $index) {
                    <tr>
                      @for (c of d.columns; track c.key) {
                        <td>
                          @if (c.key === "flowStatus") {
                            <span class="badge">{{
                              STATUS_LABEL[strOf(row[c.key] ?? "")] ??
                                (strOf(row[c.key] ?? "") || "-")
                            }}</span>
                          } @else if (c.key === "result") {
                            @if (row[c.key] === "qualified") {
                              <span class="badge">合格</span>
                            } @else if (row[c.key] === "unqualified") {
                              <span class="badge badge-destructive">不合格</span>
                            } @else {
                              -
                            }
                          } @else {
                            {{ strOf(row[c.key] ?? "-") }}
                          }
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            }
          }

          <div class="muted">
            @if (data(); as d) {
              共 {{ d.rows.length }} 条 — {{ d.summaryName }}
            }
          </div>
        </div>

        <!-- @entry M05.F01.I02 仪表盘统计卡片 -->
        <div class="grid grid5" data-fn="M05.F01.I02">
          <div class="card">
            <div class="stat-label">合同数</div>
            <div class="stat-value">{{ stats()?.contractCount ?? "-" }}</div>
          </div>
          <div class="card">
            <div class="stat-label">接样数</div>
            <div class="stat-value">{{ stats()?.receiptCount ?? "-" }}</div>
          </div>
          <div class="card">
            <div class="stat-label">样品数</div>
            <div class="stat-value">{{ stats()?.sampleCount ?? "-" }}</div>
          </div>
          <div class="card">
            <div class="stat-label">待办任务</div>
            <div class="stat-value stat-amber">
              {{ stats()?.pendingTaskCount ?? "-" }}
            </div>
          </div>
          <div class="card">
            <div class="stat-label">按状态分布</div>
            <div class="status-list">
              <div>草稿：{{ stats()?.reportCountByStatus?.draft ?? 0 }}</div>
              <div>审核中：{{ stats()?.reportCountByStatus?.reviewing ?? 0 }}</div>
              <div>已发：{{ stats()?.reportCountByStatus?.issued ?? 0 }}</div>
            </div>
          </div>
        </div>

        <!-- —— @entry M05.F01.I03 核心指标卡（REQ-2026-017，镜像 nextjs SummaryPage）—— -->
        <section class="stack" data-fn="M05.F01.I03" data-testid="dashboard-metrics">
          <h2 class="section-title">核心指标</h2>
          <div class="grid grid3">
            <div class="card" data-testid="metric-today-tests">
              <div class="stat-label">今日试验总数</div>
              <div class="stat-value">
                {{ stats()?.todayTestCount ?? "—" }}
                <span class="muted-sm">项</span>
              </div>
            </div>
            <div class="card" data-testid="metric-output">
              <div class="stat-label">报告产出量</div>
              @if (stats(); as s) {
                <div class="status-list" data-testid="metric-output-detail">
                  <div>
                    已生成：<b>{{ s.reportOutputByStatus.generated }}</b>
                  </div>
                  <div>
                    待审核：<b>{{ s.reportOutputByStatus.pending }}</b>
                  </div>
                  <div>
                    已签发：<b>{{ s.reportOutputByStatus.issued }}</b>
                  </div>
                </div>
              } @else {
                —
              }
            </div>
            <div class="card" data-testid="metric-qualified-rate">
              <div class="stat-label">检测合格率</div>
              @if (stats(); as s) {
                <ul class="status-list" data-testid="metric-qualified-detail">
                  @for (m of MATERIAL_LABELS; track m.key) {
                    <li>
                      {{ m.label }}：<b>{{
                        pct(s.qualifiedRateByMaterial[m.key].rate)
                      }}</b>
                      <span class="muted-sm">
                        ({{ s.qualifiedRateByMaterial[m.key].pass }}/{{
                          s.qualifiedRateByMaterial[m.key].total
                        }})
                      </span>
                    </li>
                  }
                </ul>
              } @else {
                —
              }
            </div>
          </div>
        </section>

        <!-- —— @entry M05.F01.I04 任务状态漏斗（REQ-2026-017，镜像 nextjs SummaryPage）—— -->
        <section class="stack" data-fn="M05.F01.I04" data-testid="dashboard-funnel">
          <h2 class="section-title">试验任务状态</h2>
          @if (stats(); as s) {
            <div class="card">
              @if (funnelTotal(s.funnelByStage) === 0) {
                <div class="muted" data-testid="funnel-empty">当前无任务</div>
              } @else {
                <div class="funnel-bars stack" data-testid="funnel-bars">
                  @for (st of FUNNEL_LABELS; track st.key; let i = $index) {
                    <div
                      class="funnel-stage"
                      [attr.data-testid]="'funnel-stage-' + st.key"
                    >
                      <div class="stage-label">{{ st.label }}</div>
                      <div class="stage-bar">
                        <div
                          class="stage-fill"
                          [style.width.%]="
                            funnelWidth(
                              i,
                              funnelTotal(s.funnelByStage),
                              s.funnelByStage[st.key]
                            )
                          "
                        ></div>
                        <div class="stage-count">{{ s.funnelByStage[st.key] }} 项</div>
                      </div>
                    </div>
                  }
                  <div class="muted funnel-total">
                    合计 {{ funnelTotal(s.funnelByStage) }} 项
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="muted">载入中…</div>
          }
        </section>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .stack > * + * {
        margin-top: 1rem;
      }
      .grid {
        display: grid;
        gap: 0.75rem;
      }
      .grid5 {
        grid-template-columns: repeat(2, 1fr);
      }
      .grid3 {
        grid-template-columns: 1fr;
      }
      @media (min-width: 768px) {
        .grid5 {
          grid-template-columns: repeat(5, 1fr);
        }
        .grid3 {
          grid-template-columns: repeat(3, 1fr);
        }
      }
      .card {
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        padding: 1rem;
      }
      h2 {
        font-size: 1rem;
        font-weight: 600;
        margin: 0 0 0.25rem;
      }
      .section-title {
        font-size: 1rem;
        font-weight: 600;
        margin: 0;
      }
      .desc {
        font-size: 0.8125rem;
        color: #64748b;
        margin: 0 0 0.75rem;
      }
      .filter-row {
        display: flex;
        align-items: flex-end;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
      }
      label {
        display: block;
        font-size: 0.8125rem;
        font-weight: 500;
        margin-bottom: 0.25rem;
      }
      select {
        width: 12rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.25rem;
        padding: 0.375rem 0.5rem;
        font-size: 0.875rem;
        background: #fff;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
      }
      th {
        background: #f8fafc;
        color: #64748b;
        text-transform: uppercase;
        font-size: 0.75rem;
        text-align: left;
      }
      th,
      td {
        padding: 0.5rem 0.75rem;
        text-align: left;
        border-top: 1px solid #e2e8f0;
      }
      .badge {
        display: inline-block;
        background: #f1f5f9;
        border-radius: 9999px;
        padding: 0.125rem 0.625rem;
        font-size: 0.75rem;
      }
      .badge-destructive {
        background: #fef2f2;
        color: #dc2626;
      }
      .muted {
        font-size: 0.875rem;
        color: #64748b;
      }
      .muted-sm {
        font-size: 0.75rem;
        color: #94a3b8;
        margin-left: 0.25rem;
      }
      .error-bar {
        background: #fef2f2;
        color: #dc2626;
        padding: 0.5rem 0.75rem;
        border-radius: 0.25rem;
        margin-bottom: 0.75rem;
        font-size: 0.875rem;
      }
      .stat-label {
        font-size: 0.8125rem;
        color: #64748b;
      }
      .stat-value {
        font-size: 1.875rem;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        padding-top: 0.25rem;
      }
      .stat-amber {
        color: #d97706;
      }
      .status-list {
        font-size: 0.875rem;
        padding-top: 0.25rem;
      }
      .status-list > * + * {
        margin-top: 0.25rem;
      }
      .status-list {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .funnel-stage {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .stage-label {
        width: 5rem;
        flex-shrink: 0;
        font-size: 0.75rem;
        color: #64748b;
      }
      .stage-bar {
        position: relative;
        flex: 1;
        height: 1.75rem;
        background: #f1f5f9;
        border-radius: 0.25rem;
        overflow: hidden;
      }
      .stage-fill {
        height: 100%;
        background: #3b82f6;
      }
      .stage-count {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-right: 0.5rem;
        font-size: 0.75rem;
        font-variant-numeric: tabular-nums;
      }
      .funnel-total {
        font-size: 0.75rem;
        padding-top: 0.25rem;
      }
    `,
  ],
})
export class SummaryListComponent {
  protected readonly STATUS_LABEL = STATUS_LABEL;
  protected readonly FUNNEL_LABELS = FUNNEL_LABELS;
  protected readonly MATERIAL_LABELS = MATERIAL_LABELS;
  protected readonly pct = pct;

  /** 模板禁直调全局（String/Number 同坑）：单元格值 → 字符串。 */
  protected strOf(v: unknown): string {
    return String(v);
  }

  private readonly api = inject(SummaryService);

  readonly data = signal<SummaryData | null>(null);
  readonly stats = signal<DashboardStats | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly categoryCode = signal("ALL");

  constructor() {
    // B6 加载态：首屏取数触发器在门控之前（react useEffect 同刻）
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const param = this.categoryCode() !== "ALL" ? this.categoryCode() : undefined;
    // react Promise.all 1:1：汇总失败落 error，stats 失败静默（卡面留占位）
    const summaryP = firstValueFrom(
      this.api.summaryGetReportSummary(
        compactParams({ categoryCode: param }) as Parameters<
          SummaryService["summaryGetReportSummary"]
        >[0],
      ),
    ).then((res) => this.data.set(res ?? null));
    const statsP = firstValueFrom(this.api.summaryGetDashboardStats()).then((res) =>
      this.stats.set(res ?? null),
    );
    try {
      await Promise.all([
        summaryP.catch((e: unknown) => {
          this.data.set(null);
          this.error.set((e as { message?: string }).message || "汇总加载失败");
        }),
        statsP.catch(() => undefined),
      ]);
    } finally {
      this.loading.set(false);
    }
  }

  /** 漏斗合计（六段计数和）。 */
  protected funnelTotal(counts: DashboardStatsFunnelByStage): number {
    return FUNNEL_LABELS.reduce((acc, s) => acc + (counts[s.key] ?? 0), 0);
  }

  /** 漏斗条宽：段序 100%→50% 线性递减 × 该段占比（react 同款公式）。 */
  protected funnelWidth(index: number, total: number, count: number): number {
    const stageCount = FUNNEL_LABELS.length;
    const widthPct = 100 - (index * 50) / (stageCount - 1);
    return Number(((count / total) * widthPct).toFixed(2));
  }
}
