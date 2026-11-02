// M03.F05/F06/F07/F08 报告审核/批准/发放/归档 4 阶段页 — 流程线第四至第七环节。
// 移植自 lab-management-system-react/src/features/reports/ReportPhasePage.tsx
//（REQ-2026-031 L-T4，行为 1:1；react Dialog → MatDialog，toast → 页内提示条）。
//
// - 共享 ReportPhasePage（参数：stage + submitLabel + i01/i02 I-level data-fn）
// - 4 个 page wrapper 各传一组 stage/submitLabel/data-fn（pages/report-*-page.ts）
// - 顶部筛选 + 列表（按 flowStatus={stage} 过滤接样单）
// - 选中行后「{submitLabel}」/「退回」按钮调阶段 act 端点推进状态机
// - M03 全 act 模式（ADR-0035）：review→review/act；approval→approve/act；
//   issuance→issuance/act；archived→archived/act
// - 「退回」= action=return，批次回退一阶；submit={submitLabel}= action=submit
// - 报告发放阶段（F07）额外在提交后生成报告编号（后端 act 语义已含，此处只显示）
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { firstValueFrom } from "rxjs";

import { PageLoadingComponent } from "../../ui/page-loading.component";
import { FLOW_STAGE_LABELS } from "../../lib/flow-labels";
import { ReceiptsService } from "../../../api/endpoints/receipts/receipts.service";
import { compactParams } from "../../../api/params";
import type { FlowStatus } from "../../../api/endpoints/model/flowStatus";
import type { FlowActionRequest } from "../../../api/endpoints/model/flowActionRequest";
import type { FlowActionResult } from "../../../api/endpoints/model/flowActionResult";
import type { SampleReceipt } from "../../../api/endpoints/model/sampleReceipt";

type PhaseStage = "review" | "approval" | "issuance" | "archived";

/** 退回原因弹窗数据（回退一阶映射在描述文案用）。 */
const PREV_STAGE: Record<PhaseStage, FlowStatus> = {
  review: "data_entry",
  approval: "review",
  issuance: "approval",
  archived: "issuance",
};

@Component({
  selector: "app-report-phase-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    PageLoadingComponent,
  ],
  template: `
    @if (loading() && rows().length === 0) {
      <app-page-loading />
    } @else {
      <div class="header">
        <div>
          <h1>{{ title() }}</h1>
          <p class="desc">{{ subtitle() }}</p>
        </div>
      </div>

      @if (notice(); as msg) {
        <div role="status" class="notice">{{ msg }}</div>
      }
      @if (error(); as err) {
        <div role="alert" class="error-bar">{{ err }}</div>
      }

      <div class="toolbar">
        <mat-form-field class="w56">
          <mat-label>搜索</mat-label>
          <input
            matInput
            placeholder="按委托书编号搜索"
            [value]="keyword()"
            (input)="keyword.set($any($event.target).value)"
            (keyup.enter)="load()"
          />
        </mat-form-field>
        <button mat-button (click)="load()">搜索</button>
        <div class="spacer"></div>
        <!-- @entry 提交按钮（i02DataFn 由 page wrapper 透传） -->
        <button
          mat-button
          [disabled]="submitting() || selected().size === 0"
          (click)="batchSubmit()"
          [attr.data-fn]="i02DataFn()"
        >
          {{ submitLabel() }}（{{ selected().size }}）
        </button>
      </div>

      <div class="card">
        <div class="card-head">
          <h3>{{ title() }}（{{ total() || "…" }}）</h3>
          @if (loading()) {
            <span class="muted-xs">加载中…</span>
          }
        </div>
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  [checked]="allSelected()"
                  (change)="toggleAll()"
                  aria-label="全选"
                />
              </th>
              <th>委托书编号</th>
              <th>工程名称</th>
              <th>检测结果</th>
              <th>流程状态</th>
              <th class="ops">操作</th>
            </tr>
          </thead>
          <tbody>
            @if (rows().length === 0 && !loading()) {
              <tr>
                <td colspan="6" class="empty">（无数据）</td>
              </tr>
            }
            @for (r of rows(); track r.id) {
              <tr [attr.data-fn]="i01DataFn()">
                <td>
                  <input
                    type="checkbox"
                    [checked]="selected().has(r.id)"
                    (change)="toggleOne(r.id)"
                    [attr.aria-label]="'选择 ' + r.commissionCode"
                  />
                </td>
                <td class="mono">
                  <a class="code-link" [routerLink]="['/receipts', r.id]">{{
                    r.commissionCode
                  }}</a>
                </td>
                <td>{{ r.projectName ?? "—" }}</td>
                <td>
                  {{
                    r.result === "pass" ? "合格" : r.result === "fail" ? "不合格" : "—"
                  }}
                </td>
                <td class="stage">
                  {{ FLOW_STAGE_LABELS[r.flowStatus] ?? r.flowStatus }}
                </td>
                <td class="ops">
                  <button mat-button class="return-btn" (click)="openReturn(r)">
                    退回
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .header {
        margin-bottom: 1rem;
      }
      h1 {
        font-size: 1.5rem;
        margin: 0;
      }
      .desc {
        font-size: 0.875rem;
        color: #64748b;
        margin: 0.25rem 0 0;
      }
      .notice {
        background: #f0fdf4;
        color: #15803d;
        padding: 0.5rem 0.75rem;
        border-radius: 0.25rem;
        margin-bottom: 0.75rem;
        font-size: 0.875rem;
      }
      .error-bar {
        background: #fef2f2;
        color: #dc2626;
        padding: 0.5rem 0.75rem;
        border-radius: 0.25rem;
        margin-bottom: 0.75rem;
        font-size: 0.875rem;
      }
      .toolbar {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 1rem;
      }
      .w56 {
        width: 18rem;
      }
      .spacer {
        flex: 1;
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
      h3 {
        font-size: 1rem;
        font-weight: 600;
        margin: 0;
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
        padding: 0.5rem 1rem;
        text-align: left;
      }
      tbody tr {
        border-top: 1px solid #e2e8f0;
      }
      .stage {
        font-size: 0.75rem;
      }
      .code-link {
        color: #2563eb;
      }
      .ops {
        text-align: right;
        white-space: nowrap;
      }
      .return-btn {
        color: #dc2626;
      }
      .mono {
        font-family: ui-monospace, monospace;
        font-size: 0.75rem;
      }
      .muted-xs {
        font-size: 0.75rem;
        color: #94a3b8;
      }
      .empty {
        text-align: center;
        color: #94a3b8;
        padding: 2rem;
      }
    `,
  ],
})
export class ReportPhasePageComponent {
  protected readonly FLOW_STAGE_LABELS = FLOW_STAGE_LABELS;

  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly stage = input.required<PhaseStage>();
  readonly submitLabel = input.required<string>();
  /** M03.F0x.I01 页锚点（表格行 data-fn） */
  readonly i01DataFn = input.required<string>();
  /** M03.F0x.I02 提交按钮 data-fn */
  readonly i02DataFn = input<string | undefined>(undefined);

  private readonly api = inject(ReceiptsService);
  private readonly dialog = inject(MatDialog);

  readonly rows = signal<SampleReceipt[]>([]);
  readonly total = signal(0);
  readonly keyword = signal("");
  // B6 加载态：首屏即视为加载中（首帧不渲染空表壳；refetch 走 per-widget 加载中）
  readonly loading = signal(true);
  readonly selected = signal<Set<string>>(new Set());
  readonly submitting = signal(false);
  // toast.success/error 等价：页内提示条
  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  /** stage → 该阶段的 act 端点（M03 全 act 模式，ADR-0035）。 */
  private act(stage: PhaseStage, req: FlowActionRequest) {
    switch (stage) {
      case "review":
        return this.api.receiptsActFlowReview(req);
      case "approval":
        return this.api.receiptsActFlowApprove(req);
      case "issuance":
        return this.api.receiptsActFlowIssuance(req);
      case "archived":
        return this.api.receiptsActFlowArchived(req);
    }
  }

  constructor() {
    // B6 加载态：首屏取数触发器在门控之前（react loadTriggered 同款防死锁）。
    // afterNextRender：input.required（stage 等）绑定完成后才可读——constructor
    // 直调会 NG0950（L-T4 实测），react useEffect 挂后执行语义对齐。
    afterNextRender(() => {
      void this.load();
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.api.receiptsListReceipts(
          compactParams({
            page: 1,
            pageSize: 50,
            flowStatus: this.stage() as FlowStatus,
            keyword: this.keyword() || undefined,
          }),
        ),
      );
      this.rows.set(Array.isArray(res.items) ? res.items : []);
      this.total.set(typeof res.total === "number" ? res.total : 0);
      this.selected.set(new Set());
    } finally {
      this.loading.set(false);
    }
  }

  readonly allSelected = () =>
    this.rows().length > 0 && this.selected().size === this.rows().length;

  toggleAll(): void {
    this.selected.set(
      this.allSelected() ? new Set() : new Set(this.rows().map((r) => r.id)),
    );
  }

  toggleOne(id: string): void {
    this.selected.update((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async batchSubmit(): Promise<void> {
    if (this.selected().size === 0) {
      this.error.set("请先选择接样单");
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.act(this.stage(), {
          ids: Array.from(this.selected()),
          action: "submit",
          operator: "current-user",
        }),
      );
      const failed = (res ?? []).filter((r: FlowActionResult) => !r.ok);
      if (failed.length === 0) {
        this.notice.set(`${this.submitLabel()}完成（${this.selected().size} 单）`);
      } else {
        this.error.set(
          `${failed.length} 单处理失败：${(failed[0] as FlowActionResult).message ?? ""}`,
        );
      }
      await this.load();
    } catch (e) {
      this.error.set((e as { message?: string }).message || "提交失败");
    } finally {
      this.submitting.set(false);
    }
  }

  openReturn(r: SampleReceipt): void {
    const ref = this.dialog.open(ReportReturnDialogComponent, {
      width: "28rem",
      data: {
        receipt: r,
        prevStageLabel: FLOW_STAGE_LABELS[PREV_STAGE[this.stage()]] ?? "上一环节",
      },
    });
    void firstValueFrom(ref.afterClosed()).then(async (returned) => {
      if (!returned) return;
      this.notice.set("已退回");
      await this.load();
    });
  }
}

/** 退回弹窗（react 内联 Dialog 1:1：退回原因可选，action=return 回退一阶）。 */
@Component({
  selector: "app-report-return-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>退回 — {{ data.receipt.commissionCode }}</h2>
    <mat-dialog-content>
      <p class="desc">退回后该接样单回到上一环节（{{ data.prevStageLabel }}）。</p>
      @if (saveError(); as err) {
        <div role="alert" class="save-error">{{ err }}</div>
      }
      <div class="fields">
        <mat-form-field>
          <mat-label>退回原因（可选）</mat-label>
          <input
            matInput
            name="returnReason"
            placeholder="如：数据待补正"
            [value]="returnReason()"
            (input)="returnReason.set($any($event.target).value)"
          />
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        class="confirm-return"
        (click)="confirmReturn()"
        [disabled]="submitting()"
      >
        确认退回
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .desc {
        font-size: 0.75rem;
        color: #64748b;
        margin: 0 0 0.75rem;
      }
      .save-error {
        color: #dc2626;
        background: #fef2f2;
        padding: 0.5rem;
        border-radius: 0.25rem;
        margin-bottom: 0.75rem;
        font-size: 0.875rem;
      }
      .fields mat-form-field {
        width: 100%;
      }
      .confirm-return {
        color: #dc2626;
      }
    `,
  ],
})
export class ReportReturnDialogComponent {
  readonly data: { receipt: SampleReceipt; prevStageLabel: string } =
    inject(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<ReportReturnDialogComponent, boolean>>(MatDialogRef);

  private readonly api = inject(ReceiptsService);

  readonly submitting = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly returnReason = signal("");

  private act(stage: PhaseStage, req: FlowActionRequest) {
    switch (stage) {
      case "review":
        return this.api.receiptsActFlowReview(req);
      case "approval":
        return this.api.receiptsActFlowApprove(req);
      case "issuance":
        return this.api.receiptsActFlowIssuance(req);
      case "archived":
        return this.api.receiptsActFlowArchived(req);
    }
  }

  async confirmReturn(): Promise<void> {
    this.submitting.set(true);
    this.saveError.set(null);
    try {
      await firstValueFrom(
        this.act(this.data.receipt.flowStatus as PhaseStage, {
          ids: [this.data.receipt.id],
          action: "return",
          operator: "current-user",
          reason: this.returnReason().trim() || undefined,
        }),
      );
      this.ref.close(true);
    } catch (err) {
      this.saveError.set((err as { message?: string }).message || "退回失败");
    } finally {
      this.submitting.set(false);
    }
  }
}
