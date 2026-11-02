// M03.F02 任务分配 — 流程线第二环节（flowStatus='task_assignment'）。列表 +
// 安排弹窗（PUT /api/receipts/{id}/task）。移植自
// lab-management-system-react/src/features/task-assignment/TaskAssignmentList.tsx
//（REQ-2026-031 L-T3②，行为 1:1；react Dialog → MatDialog，toast → 页内提示条）。
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
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
import type { SampleReceipt } from "../../../api/endpoints/model/sampleReceipt";

@Component({
  selector: "app-task-assignment-list",
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
    @if (loading() && items().length === 0) {
      <app-page-loading />
    } @else {
      <div class="header">
        <div>
          <!-- @entry M03.F02.I01 任务分配队列页 -->
          <h1>任务分配</h1>
          <p class="desc">
            M03.F02 为接样单指定检测人员与计划日期（flowStatus=task_assignment）
          </p>
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
      </div>

      <div class="card">
        <div class="card-head">
          <h3>待安排接样单（{{ total() || "…" }}）</h3>
          @if (loading()) {
            <span class="muted-xs">加载中…</span>
          }
        </div>
        <table>
          <thead>
            <tr>
              <th>委托书编号</th>
              <th>工程名称</th>
              <th>检测人员</th>
              <th>计划日期</th>
              <th>流程状态</th>
              <th class="ops">操作</th>
            </tr>
          </thead>
          <tbody>
            @if (items().length === 0 && !loading()) {
              <tr>
                <td colspan="6" class="empty">（无待安排接样单）</td>
              </tr>
            }
            @for (r of items(); track r.id) {
              <tr>
                <td class="mono">
                  <a class="code-link" [routerLink]="['/receipts', r.id]">{{
                    r.commissionCode
                  }}</a>
                </td>
                <td>{{ r.projectName ?? "—" }}</td>
                <td>
                  {{ r.assigneeName ?? "待安排" }}
                </td>
                <td>{{ r.plannedTestDate ?? "—" }}</td>
                <td class="stage">
                  {{ FLOW_STAGE_LABELS[r.flowStatus] ?? r.flowStatus }}
                </td>
                <td class="ops">
                  <!-- @entry M03.F02.I01 安排按钮开弹窗 -->
                  <button mat-button (click)="openAssign(r)" data-fn="M03.F02.I01">
                    安排
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
        display: flex;
        align-items: center;
        justify-content: space-between;
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
export class TaskAssignmentListComponent {
  protected readonly FLOW_STAGE_LABELS = FLOW_STAGE_LABELS;

  private readonly api = inject(ReceiptsService);
  private readonly dialog = inject(MatDialog);

  readonly items = signal<SampleReceipt[]>([]);
  readonly total = signal(0);
  readonly keyword = signal("");
  // B6 加载态：首屏即视为加载中（首帧不渲染空表壳；refetch 走 per-widget 加载中）
  readonly loading = signal(true);
  // toast.success/error 等价：页内提示条（保存后「任务已安排」/ 失败红条）
  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    // B6 加载态：首屏取数触发器在门控之前（react loadTriggered 同款防死锁）
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.api.receiptsListReceipts(
          compactParams({
            page: 1,
            pageSize: 50,
            flowStatus: "task_assignment" as FlowStatus,
            keyword: this.keyword() || undefined,
          }),
        ),
      );
      this.items.set(Array.isArray(res.items) ? res.items : []);
      this.total.set(typeof res.total === "number" ? res.total : 0);
    } finally {
      this.loading.set(false);
    }
  }

  openAssign(r: SampleReceipt): void {
    const ref = this.dialog.open(TaskAssignDialogComponent, {
      width: "28rem",
      data: { receipt: r },
    });
    void firstValueFrom(ref.afterClosed()).then(async (saved) => {
      if (!saved) return;
      this.notice.set("任务已安排");
      await this.load();
    });
  }
}

/** 安排弹窗（react 内联 Dialog 1:1：检测人员 + 计划检测日期，空值禁保存）。 */
@Component({
  selector: "app-task-assign-dialog",
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
    <h2 mat-dialog-title>任务安排 — {{ data.receipt.commissionCode }}</h2>
    <mat-dialog-content>
      <p class="desc">指定检测人员与计划检测日期。</p>
      @if (saveError(); as err) {
        <div role="alert" class="save-error">{{ err }}</div>
      }
      <div class="fields">
        <mat-form-field>
          <mat-label>检测人员 *</mat-label>
          <input
            matInput
            name="assigneeName"
            placeholder="如：张三"
            [value]="assigneeName()"
            (input)="assigneeName.set($any($event.target).value)"
          />
        </mat-form-field>
        <mat-form-field>
          <mat-label>计划检测日期 *</mat-label>
          <input
            matInput
            name="plannedTestDate"
            type="date"
            [value]="plannedTestDate()"
            (input)="plannedTestDate.set($any($event.target).value)"
          />
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <!-- @entry M03.F02.I02 安排保存（检测人员/计划日期均非空才可点） -->
      <button
        mat-button
        (click)="save()"
        [disabled]="saving() || !assigneeName().trim() || !plannedTestDate()"
        data-fn="M03.F02.I02"
      >
        保存
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
      .fields {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      mat-form-field {
        width: 100%;
      }
    `,
  ],
})
export class TaskAssignDialogComponent {
  readonly data: { receipt: SampleReceipt } = inject(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<TaskAssignDialogComponent, boolean>>(MatDialogRef);

  private readonly api = inject(ReceiptsService);

  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly assigneeName = signal(this.data.receipt.assigneeName ?? "");
  readonly plannedTestDate = signal(
    this.data.receipt.plannedTestDate ?? new Date().toISOString().slice(0, 10),
  );

  async save(): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const name = this.assigneeName().trim();
      await firstValueFrom(
        this.api.receiptsAssignTask(this.data.receipt.id, {
          assigneeName: name,
          assigneeId: name ? `u-${name}` : undefined,
          plannedTestDate: this.plannedTestDate(),
        }),
      );
      this.ref.close(true);
    } catch (err) {
      this.saveError.set((err as { message?: string }).message || "保存失败");
    } finally {
      this.saving.set(false);
    }
  }
}
