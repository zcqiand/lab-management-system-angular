// M03.F01 接样管理 — 流程线第一环节（flowStatus='receiving'）。列表 + 三态过滤
// + MatDialog 弹窗（新建/编辑）+ 行内删除 + 提交推进状态机。移植自
// lab-management-system-react/src/features/receipts/ReceiptsList.tsx
//（REQ-2026-031 L-T3①，行为 1:1；react Dialog → MatDialog，toast → 页内提示条）。
//
// UI 模式（对齐 REF nextjs ReceiptList）：
//   - 顶部 flowStatus 三态过滤（全部 / 接样中 / 已提交）+ 关键字
//   - 表格：委托书编号(Link /receipts/:id) / 工程名称 / 委托单位 / 检测类别 /
//     流程状态 / 创建时间 / 操作
//   - 「提交」按钮推进状态机 receiving → task_assignment
//     （POST /api/receipts/receiving/act，M03 全 act 模式）
//   - 「详情」链接到 /receipts/:id（M03.F09.I01 入口）
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
import { ContractsService } from "../../../api/endpoints/contracts/contracts.service";
import { ReceiptsService } from "../../../api/endpoints/receipts/receipts.service";
import { ReportNamesService } from "../../../api/endpoints/report-names/report-names.service";
import { compactParams } from "../../../api/params";
import type { Contract } from "../../../api/endpoints/model/contract";
import type { FlowStatus } from "../../../api/endpoints/model/flowStatus";
import type { InspectionReportName } from "../../../api/endpoints/model/inspectionReportName";
import type { SampleReceipt } from "../../../api/endpoints/model/sampleReceipt";

type Mode = { kind: "idle" } | { kind: "create" } | { kind: "edit"; id: string };
type FlowFilter = "" | "receiving" | "submitted";

interface ReceiptBody {
  contractId: string;
  commissionCode: string;
  commissionDate: string;
  projectName: string;
  clientUnit: string;
  testCategory: string;
  sampleSource: string;
  categoryCode: string;
}

const EMPTY_BODY: ReceiptBody = {
  contractId: "",
  commissionCode: "",
  commissionDate: "",
  projectName: "",
  clientUnit: "",
  testCategory: "委托检验",
  sampleSource: "施工送检",
  categoryCode: "",
};

@Component({
  selector: "app-receipts-list",
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
          <!-- @entry M03.F01.I01 接样管理列表页 -->
          <h1>接样管理</h1>
          <p class="desc">M03.F01 接样单 CRUD 与提交</p>
        </div>
        <!-- @entry M03.F01.I02 新建接样按钮 -->
        <button mat-button (click)="openCreate()" data-fn="M03.F01.I02">新建接样</button>
      </div>

      @if (notice(); as msg) {
        <div role="status" class="notice">{{ msg }}</div>
      }
      @if (error(); as err) {
        <div role="alert" class="error-bar">{{ err }}</div>
      }

      <div class="toolbar">
        <select
          class="flow-select"
          [value]="flowFilter()"
          (change)="flowFilter.set($any($event.target).value)"
        >
          <option value="">全部状态</option>
          <option value="receiving">接样中</option>
          <option value="submitted">已提交</option>
        </select>
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
          <h3>接样列表（{{ total() || "…" }}）</h3>
          @if (loading()) {
            <span class="muted-xs">加载中…</span>
          }
        </div>
        <table>
          <thead>
            <tr>
              <th>委托书编号</th>
              <th>工程名称</th>
              <th>委托单位</th>
              <th>检测类别</th>
              <th>流程状态</th>
              <th>创建时间</th>
              <th class="ops">操作</th>
            </tr>
          </thead>
          <tbody>
            @if (items().length === 0 && !loading()) {
              <tr>
                <td colspan="7" class="empty">（无数据）</td>
              </tr>
            }
            @for (r of items(); track r.id) {
              <tr data-fn="M03.F01.I01">
                <td class="mono">
                  <a class="code-link" [routerLink]="['/receipts', r.id]">{{
                    r.commissionCode
                  }}</a>
                </td>
                <td>{{ r.projectName ?? "—" }}</td>
                <td>{{ r.clientUnit ?? "—" }}</td>
                <td>{{ r.testCategory }}</td>
                <td>
                  <span
                    class="badge"
                    [class.badge-green]="r.flowStatus === 'completed'"
                    >{{ FLOW_STAGE_LABELS[r.flowStatus] ?? r.flowStatus }}</span
                  >
                </td>
                <td class="muted-xs">{{ r.createdAt?.slice(0, 10) ?? "—" }}</td>
                <td class="ops">
                  @if (r.flowStatus === "receiving") {
                    <button
                      mat-button
                      (click)="submitReceipt(r.id)"
                      [disabled]="submitting() === r.id"
                      data-fn="M03.F01.I04"
                    >
                      提交
                    </button>
                  }
                  <button mat-button (click)="openEdit(r)">编辑</button>
                  @if (r.flowStatus === "receiving") {
                    <button
                      mat-button
                      class="danger"
                      (click)="askDelete(r)"
                      data-fn="M03.F01.I03"
                    >
                      删除
                    </button>
                  }
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
      .flow-select {
        border: 1px solid #cbd5e1;
        border-radius: 0.25rem;
        height: 2.25rem;
        padding: 0 0.5rem;
        font-size: 0.875rem;
        background: #fff;
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
      .badge {
        display: inline-block;
        border-radius: 0.25rem;
        background: #e2e8f0;
        padding: 0.125rem 0.5rem;
        font-size: 0.75rem;
        color: #475569;
      }
      .badge-green {
        background: #dcfce7;
        color: #15803d;
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
      button.danger {
        color: #dc2626;
      }
    `,
  ],
})
export class ReceiptsListComponent {
  // 模板引用（protected 语义；readonly 常量表非组件状态）
  protected readonly FLOW_STAGE_LABELS = FLOW_STAGE_LABELS;

  private readonly api = inject(ReceiptsService);
  private readonly contractsApi = inject(ContractsService);
  private readonly reportNamesApi = inject(ReportNamesService);
  private readonly dialog = inject(MatDialog);

  readonly items = signal<SampleReceipt[]>([]);
  readonly total = signal(0);
  readonly flowFilter = signal<FlowFilter>("");
  readonly keyword = signal("");
  readonly mode = signal<Mode>({ kind: "idle" });
  // B6 加载态：首屏即视为加载中（首帧不渲染空表壳；refetch 走 per-widget 加载中）
  readonly loading = signal(true);
  readonly deleteTarget = signal<SampleReceipt | null>(null);
  readonly submitting = signal<string | null>(null);
  // toast.success/error 等价：页内提示条（成功绿 / 失败红，语义可见不吞）
  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  // 合同下拉选项（创建接样必选合同——契约 contractId FK 校验，占位字面量必 400）
  readonly contracts = signal<Contract[]>([]);
  // 报告名称下拉（categoryCode FK→inspection_report_names.code，自由文本必 400）
  readonly reportNames = signal<InspectionReportName[]>([]);

  constructor() {
    // B6 加载态：首屏取数触发器在门控之前（react loadTriggered 同款防死锁）
    void this.load();
    void this.loadRefs();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      // 三态过滤：接样中 → flowStatus=receiving；已提交 → flowStatus=task_assignment
      const flowStatus =
        this.flowFilter() === "receiving"
          ? ("receiving" as FlowStatus)
          : this.flowFilter() === "submitted"
            ? ("task_assignment" as FlowStatus)
            : undefined;
      const res = await firstValueFrom(
        this.api.receiptsListReceipts(
          compactParams({
            page: 1,
            pageSize: 50,
            flowStatus,
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

  /** 弹窗下拉选项：合同 + 报告名称（react useEffect 两跳，angular 显式并发加载） */
  private async loadRefs(): Promise<void> {
    try {
      const contracts = await firstValueFrom(
        this.contractsApi.contractsListContracts(
          compactParams({ page: 1, pageSize: 200 }),
        ),
      );
      this.contracts.set(Array.isArray(contracts.items) ? contracts.items : []);
    } catch {
      this.contracts.set([]);
    }
    try {
      const reportNames = await firstValueFrom(
        this.reportNamesApi.reportNamesListReportNames(
          compactParams({ page: 1, pageSize: 200 }),
        ),
      );
      this.reportNames.set(Array.isArray(reportNames.items) ? reportNames.items : []);
    } catch {
      this.reportNames.set([]);
    }
  }

  async submitReceipt(id: string): Promise<void> {
    this.submitting.set(id);
    this.notice.set(null);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.api.receiptsActFlowReceiving({
          ids: [id],
          action: "submit",
          operator: "current-user",
        }),
      );
      const r = res[0];
      if (r?.ok) {
        this.notice.set("接样单已提交到任务安排");
        await this.load();
      } else {
        this.error.set(r?.message ?? "提交失败");
      }
    } catch (err) {
      this.error.set((err as { message?: string }).message || "提交失败");
    } finally {
      this.submitting.set(null);
    }
  }

  openCreate(): void {
    void this.openForm(null);
  }

  openEdit(r: SampleReceipt): void {
    void this.openForm(r);
  }

  private async openForm(editing: SampleReceipt | null): Promise<void> {
    const ref = this.dialog.open(ReceiptFormDialogComponent, {
      width: "44rem",
      data: {
        editing,
        contracts: this.contracts(),
        reportNames: this.reportNames(),
      },
    });
    const saved = (await firstValueFrom(ref.afterClosed())) as boolean | undefined;
    if (saved) {
      this.notice.set(editing ? "接样单已更新" : "接样单已创建");
      await this.load();
    }
  }

  askDelete(r: SampleReceipt): void {
    const ref = this.dialog.open(ReceiptConfirmDialogComponent, {
      width: "26rem",
      data: { code: r.commissionCode },
    });
    void firstValueFrom(ref.afterClosed()).then(async (ok) => {
      if (!ok) return;
      try {
        await firstValueFrom(this.api.receiptsDeleteReceipt(r.id));
        this.notice.set("接样单已删除");
        await this.load();
      } catch (err) {
        this.error.set((err as { message?: string }).message || "删除失败");
      }
    });
  }
}

/** 表单弹窗（新建/编辑共用；react ReceiptFormBody 1:1——合同编辑态锁定）。 */
@Component({
  selector: "app-receipt-form-dialog",
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
    <h2 mat-dialog-title>
      {{ data.editing ? "编辑接样 " + data.editing.commissionCode : "新建接样" }}
    </h2>
    <mat-dialog-content>
      <p class="desc">
        @if (data.editing) {
          修改接样字段后保存。
        } @else {
          录入委托书基础信息（带 * 字段必填）。
        }
      </p>
      @if (saveError(); as err) {
        <div role="alert" class="save-error">{{ err }}</div>
      }
      <div class="grid2">
        <div class="field">
          <label class="plain-label">所属合同 *</label>
          <select
            class="native-select"
            name="contractId"
            [(ngModel)]="body.contractId"
            [disabled]="data.editing !== null"
          >
            <option value="">请选择合同</option>
            @for (c of data.contracts; track c.id) {
              <option [value]="c.id">{{ c.contractCode + SEP + c.projectName }}</option>
            }
          </select>
        </div>
        <mat-form-field>
          <mat-label>委托书编号 *</mat-label>
          <input matInput name="commissionCode" [(ngModel)]="body.commissionCode" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>委托日期 *</mat-label>
          <input matInput name="commissionDate" [(ngModel)]="body.commissionDate" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>工程名称 *</mat-label>
          <input matInput name="projectName" [(ngModel)]="body.projectName" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>委托单位 *</mat-label>
          <input matInput name="clientUnit" [(ngModel)]="body.clientUnit" />
        </mat-form-field>
        <div class="field">
          <label class="plain-label">检测类别 *</label>
          <select
            class="native-select"
            name="testCategory"
            [(ngModel)]="body.testCategory"
          >
            <option value="委托检验">委托检验</option>
            <option value="监督检验">监督检验</option>
            <option value="仲裁检验">仲裁检验</option>
          </select>
        </div>
        <div class="field">
          <label class="plain-label">样品来源 *</label>
          <select
            class="native-select"
            name="sampleSource"
            [(ngModel)]="body.sampleSource"
          >
            <option value="施工送检">施工送检</option>
            <option value="监督抽检">监督抽检</option>
            <option value="委托送样">委托送样</option>
          </select>
        </div>
        <div class="field">
          <label class="plain-label">报告名称 *</label>
          <select
            class="native-select"
            name="categoryCode"
            [(ngModel)]="body.categoryCode"
          >
            <option value="">请选择报告名称</option>
            @for (rn of data.reportNames; track rn.code) {
              <option [value]="rn.code">{{ rn.name }}</option>
            }
          </select>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <!-- @entry M03.F01.I02 表单内保存（新建/编辑共用同一按钮） -->
      <button mat-button (click)="submit()" data-fn="M03.F01.I02">保存</button>
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
      .grid2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
        max-height: 60vh;
        overflow-y: auto;
      }
      mat-form-field {
        width: 100%;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .plain-label {
        font-size: 0.75rem;
        color: #64748b;
      }
      .native-select {
        border: 1px solid #cbd5e1;
        border-radius: 0.25rem;
        height: 2.25rem;
        padding: 0 0.5rem;
        font-size: 0.875rem;
        background: #fff;
      }
      .native-select:disabled {
        background: #f1f5f9;
      }
    `,
  ],
})
export class ReceiptFormDialogComponent {
  // react 选项文案 1:1：编号 + 全角空格(U+3000) + 项目名。全角空格用码点构造——
  // 源码写原始字符会被 no-irregular-whitespace 拦（字符串字面量也不豁免）。
  protected readonly SEP = String.fromCharCode(0x3000);

  readonly data: {
    editing: SampleReceipt | null;
    contracts: Contract[];
    reportNames: InspectionReportName[];
  } = inject(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<ReceiptFormDialogComponent, boolean>>(MatDialogRef);

  private readonly api = inject(ReceiptsService);

  readonly saveError = signal<string | null>(null);

  readonly body: ReceiptBody = this.data.editing
    ? {
        contractId: this.data.editing.contractId,
        commissionCode: this.data.editing.commissionCode,
        commissionDate: this.data.editing.commissionDate,
        projectName: this.data.editing.projectName ?? "",
        clientUnit: this.data.editing.clientUnit ?? "",
        testCategory: this.data.editing.testCategory,
        sampleSource: this.data.editing.sampleSource,
        categoryCode: this.data.editing.categoryCode,
      }
    : { ...EMPTY_BODY };

  async submit(): Promise<void> {
    this.saveError.set(null);
    if (!this.data.editing) {
      // react 同款守卫：contractId / categoryCode 是 FK，占位空值必 400
      if (!this.body.contractId) {
        this.saveError.set("请选择合同");
        return;
      }
      if (!this.body.categoryCode) {
        this.saveError.set("请选择报告名称");
        return;
      }
      try {
        await firstValueFrom(
          this.api.receiptsCreateReceipt({
            ...this.body,
            receivedBy: "current-user",
          }),
        );
        this.ref.close(true);
      } catch (err) {
        this.saveError.set((err as { message?: string }).message || "保存失败");
      }
      return;
    }
    try {
      await firstValueFrom(
        this.api.receiptsUpdateReceipt(this.data.editing.id, this.body),
      );
      this.ref.close(true);
    } catch (err) {
      this.saveError.set((err as { message?: string }).message || "保存失败");
    }
  }
}

/** 删除确认弹窗（react ConfirmModal 等价：标题「删除接样」）。 */
@Component({
  selector: "app-receipt-confirm-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>删除接样</h2>
    <mat-dialog-content>
      <p>确认删除接样单 {{ data.code }}？其下样品与检测记录将一并删除。</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">取消</button>
      <button mat-button class="danger" (click)="ref.close(true)">确认删除</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      button.danger {
        color: #dc2626;
      }
    `,
  ],
})
export class ReceiptConfirmDialogComponent {
  readonly data: { code: string } = inject(MAT_DIALOG_DATA);
  readonly ref =
    inject<MatDialogRef<ReceiptConfirmDialogComponent, boolean>>(MatDialogRef);
}
