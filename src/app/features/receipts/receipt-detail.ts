// M03.F09 接样单详情 — 流程线任一环节可查看的详情页（路由 /receipts/:id）。
// 移植自 lab-management-system-react/src/features/receipts/ReceiptDetail.tsx
//（REQ-2026-031 L-T3①，行为 1:1；react useParams → ActivatedRoute）。
//
// UI 模式（对齐 REF nextjs ReceiptDetailPage）：
//   - 接样信息表（委托书 / 工程 / 取样 / 检测类别 / 流程状态 / 报告参数等）
//   - 流程历史时间线（M03.F09.I02，flowHistory 全部条目按 at 倒序）
//   - 「报告预览」按钮（M03.F09.I03）→ 弹窗（L-T3③-tail 真化：docx 渲染链在
//     data-entry/report-preview-modal，本组件只是 mat-dialog 薄壳宿主）
//   - 「返回」按钮 → history back
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { Location } from "@angular/common";
import { ActivatedRoute } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { firstValueFrom } from "rxjs";

import { PageLoadingComponent } from "../../ui/page-loading.component";
import { FLOW_STAGE_LABELS } from "../../lib/flow-labels";
import { ReceiptsService } from "../../../api/endpoints/receipts/receipts.service";
import { ReportPreviewModalComponent } from "../data-entry/report-preview-modal";
import type { FlowAction } from "../../../api/endpoints/model/flowAction";
import type { SampleReceipt } from "../../../api/endpoints/model/sampleReceipt";

@Component({
  selector: "app-receipt-detail",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, PageLoadingComponent],
  template: `
    @if (loading()) {
      <app-page-loading />
    } @else if (error(); as err) {
      <div class="error-page">{{ err }}</div>
    } @else if (receipt(); as r) {
      <div class="page">
        <div class="card">
          <div class="card-head">
            <!-- @entry M03.F09.I01 接样单详情页 -->
            <h3>接样单详情 — {{ r.commissionCode }}</h3>
            <div class="head-ops">
              <button mat-button (click)="openPreview()" data-fn="M03.F09.I03">
                报告预览
              </button>
              <button mat-button (click)="back()">返回</button>
            </div>
          </div>
          <div class="fields">
            <div><span class="k">委托书编号：</span>{{ r.commissionCode }}</div>
            <div><span class="k">委托日期：</span>{{ r.commissionDate }}</div>
            <div><span class="k">工程名称：</span>{{ r.projectName ?? "—" }}</div>
            <div><span class="k">委托单位：</span>{{ r.clientUnit ?? "—" }}</div>
            <div><span class="k">建设单位：</span>{{ r.buildingUnit ?? "—" }}</div>
            <div><span class="k">监理单位：</span>{{ r.supervisorUnit ?? "—" }}</div>
            <div><span class="k">施工单位：</span>{{ r.constructionUnit ?? "—" }}</div>
            <div><span class="k">见证单位：</span>{{ r.witnessUnit ?? "—" }}</div>
            <div><span class="k">见证人：</span>{{ r.witness ?? "—" }}</div>
            <div><span class="k">送检人：</span>{{ r.inspector ?? "—" }}</div>
            <div><span class="k">取样地点：</span>{{ r.samplingLocation ?? "—" }}</div>
            <div><span class="k">接样人：</span>{{ r.receivedBy }}</div>
            <div><span class="k">报告类别：</span>{{ r.categoryCode }}</div>
            <div><span class="k">检测类别：</span>{{ r.testCategory }}</div>
            <div><span class="k">样品来源：</span>{{ r.sampleSource }}</div>
            <div><span class="k">合同 ID：</span>{{ r.contractId }}</div>
            <div>
              <span class="k">流程状态：</span
              >{{ FLOW_STAGE_LABELS[r.flowStatus] ?? r.flowStatus }}
            </div>
            <div><span class="k">检测结果：</span>{{ resultLabel(r) }}</div>
            @if (r.assigneeName) {
              <div><span class="k">检测负责人：</span>{{ r.assigneeName }}</div>
            }
            @if (r.plannedTestDate) {
              <div><span class="k">计划检测日期：</span>{{ r.plannedTestDate }}</div>
            }
            @if (r.reportCode) {
              <div><span class="k">报告编号：</span>{{ r.reportCode }}</div>
            }
          </div>
        </div>

        <!-- @entry M03.F09.I02 流程历史时间线（按 at 倒序） -->
        <div class="card" data-fn="M03.F09.I02">
          <div class="card-head">
            <h3>流程历史</h3>
          </div>
          <div class="card-body">
            @if (history().length === 0) {
              <div class="empty">（暂无流程操作记录）</div>
            } @else {
              <ol class="timeline">
                @for (h of history(); track $index) {
                  <li>
                    <span class="muted-xs">{{ h.at }}</span>
                    <span class="action">{{ actionLabel(h.action) }}</span>
                    <span class="stage">
                      {{ FLOW_STAGE_LABELS[h.from] }} → {{ FLOW_STAGE_LABELS[h.to] }}
                    </span>
                    <span class="muted-xs">操作人：{{ h.operator }}</span>
                    @if (h.reason) {
                      <span class="muted-xs">备注：{{ h.reason }}</span>
                    }
                  </li>
                }
              </ol>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .page {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .card {
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
      }
      .card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
      }
      .head-ops {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      h3 {
        font-size: 1rem;
        font-weight: 600;
        margin: 0;
      }
      .fields {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.5rem 1rem;
        padding: 0 1rem 1rem;
        font-size: 0.875rem;
      }
      .k {
        color: #64748b;
      }
      .card-body {
        padding: 0 1rem 1rem;
      }
      .timeline {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .timeline li {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        border-left: 2px solid #e2e8f0;
        padding-left: 0.75rem;
      }
      .action {
        font-weight: 500;
        font-size: 0.875rem;
      }
      .stage {
        font-size: 0.875rem;
        color: #475569;
      }
      .muted-xs {
        font-size: 0.75rem;
        color: #94a3b8;
      }
      .empty {
        padding: 1rem 0;
        text-align: center;
        font-size: 0.875rem;
        color: #94a3b8;
      }
      .error-page {
        padding: 2rem;
        color: #dc2626;
      }
    `,
  ],
})
export class ReceiptDetailComponent {
  protected readonly FLOW_STAGE_LABELS = FLOW_STAGE_LABELS;

  private readonly api = inject(ReceiptsService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly dialog = inject(MatDialog);

  readonly receipt = signal<SampleReceipt | null>(null);
  readonly history = signal<SampleReceipt["flowHistory"]>([]);
  // B6 加载态：首屏即视为加载中（详情未到前不渲染 null/壳）
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    const id = this.route.snapshot.paramMap.get("id");
    if (!id) {
      // B6 修复 R1：loading 初值 true，id 缺失早退也必须落定，否则整页永久 PageLoading
      this.loading.set(false);
      return;
    }
    void this.load(id);
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const r = await firstValueFrom(this.api.receiptsGetReceipt(id));
      this.receipt.set(r);
      // 时间线按 at 倒序（react 同款）
      this.history.set(
        [...(r.flowHistory ?? [])].sort((a, b) => b.at.localeCompare(a.at)),
      );
    } catch (e) {
      this.error.set((e as { message?: string }).message || "加载失败");
    } finally {
      this.loading.set(false);
    }
  }

  resultLabel(r: SampleReceipt): string {
    return r.result === "pass" ? "合格" : r.result === "fail" ? "不合格" : "—";
  }

  actionLabel(a: FlowAction): string {
    return a === "submit" ? "提交" : a === "return" ? "退回" : "撤回";
  }

  back(): void {
    this.location.back();
  }

  openPreview(): void {
    const r = this.receipt();
    if (!r) return;
    void this.dialog.open(ReportPreviewDialogComponent, {
      width: "72rem",
      data: { receipt: r },
    });
  }
}

/**
 * 报告预览弹窗宿主（mat-dialog 薄壳）。真链路在 data-entry 域的
 * ReportPreviewModalComponent（docxtemplater 填充 → docx-preview 渲染，
 * REQ-2026-031 L-T3③-tail 真化）；标题「报告预览 — {委托书编号}」由其内部
 * header 提供（react ReportPreviewModal 同源），无模板分支语义 1:1。
 */
@Component({
  selector: "app-report-preview-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, ReportPreviewModalComponent],
  template: `
    <mat-dialog-content class="preview-host">
      <app-report-preview-modal
        [open]="true"
        [receipt]="data.receipt"
        (closed)="ref.close()"
      />
    </mat-dialog-content>
  `,
  styles: [
    `
      .preview-host {
        margin: 0;
        padding: 0;
        max-height: 94vh;
      }
    `,
  ],
})
export class ReportPreviewDialogComponent {
  readonly data: { receipt: SampleReceipt } = inject(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<ReportPreviewDialogComponent, void>>(MatDialogRef);
}
