// M02.F01 合同管理 — 列表 + MatDialog 弹窗（新建/编辑）+ 行内删除。移植自
// lab-management-system-react/src/features/contracts/ContractsList.tsx
//（REQ-2026-031 L-T2，行为 1:1；react Dialog → MatDialog，toast → 弹窗内错误条）。
//
// UI 模式（对齐 REF nextjs ContractsPage）：
//   - 顶部筛选条（status select / keyword input）
//   - 表格：合同编号 / 项目名称 / 委托单位 / 见证人 / 状态 / 委托日期
//   - 「新建合同」按钮 → Dialog 弹窗（覆盖在表格之上）
//   - 编辑按钮 → Dialog 弹窗（预填该行）
//   - 删除按钮 → 确认弹窗 + 调 DELETE
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
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
import { MatSelectModule } from "@angular/material/select";
import { firstValueFrom } from "rxjs";

import { PageLoadingComponent } from "../../ui/page-loading.component";
import { ContractsService } from "../../../api/endpoints/contracts/contracts.service";
import { compactParams } from "../../../api/params";
import type { Contract } from "../../../api/endpoints/model/contract";
import { ContractStatus } from "../../../api/endpoints/model/contractStatus";

type Mode = { kind: "idle" } | { kind: "create" } | { kind: "edit"; id: string };

type ContractBody = Omit<Contract, "id" | "tenantId" | "createdAt" | "updatedAt">;

const EMPTY_BODY: ContractBody = {
  contractCode: "",
  clientUnit: "",
  projectName: "",
  projectLocation: "",
  constructionUnit: "",
  inspectionSpecialtyCode: "",
  buildingUnit: "",
  supervisorUnit: "",
  inspectionPerson: "",
  inspectionPhone: "",
  witnessUnit: "",
  witness: "",
  witnessPhone: "",
  contactPerson: "",
  contactPhone: "",
  entrustedDate: "",
  status: ContractStatus.active,
};

@Component({
  selector: "app-contracts-list",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    PageLoadingComponent,
  ],
  template: `
    <div class="page">
      @if (loading() && items().length === 0) {
        <app-page-loading />
      } @else {
        <div class="header">
          <div>
            <h1>合同管理</h1>
            <p class="desc">M02.F01 合同 CRUD 与工程信息维护</p>
          </div>
          <!-- @entry M02.F01.I02 新建合同按钮 -->
          <button mat-button (click)="openCreate()" data-fn="M02.F01.I02">
            新建合同
          </button>
        </div>

        <div class="toolbar">
          <select
            class="status-select"
            [value]="status()"
            (change)="status.set($any($event.target).value)"
          >
            <option value="">全部状态</option>
            <option value="active">在用</option>
            <option value="archived">已归档</option>
          </select>
          <mat-form-field class="w56">
            <mat-label>搜索</mat-label>
            <input
              matInput
              placeholder="按合同编号 / 项目名称搜索"
              [value]="keyword()"
              (input)="keyword.set($any($event.target).value)"
              (keyup.enter)="load()"
            />
          </mat-form-field>
          <button mat-button (click)="load()">搜索</button>
        </div>

        <div class="card">
          <div class="card-head">
            <h3>合同列表（{{ total() || "…" }}）</h3>
            @if (loading()) {
              <span class="muted-xs">加载中…</span>
            }
          </div>
          <table>
            <thead>
              <tr>
                <th>合同编号</th>
                <th>项目名称</th>
                <th>委托单位</th>
                <th>见证人</th>
                <th>状态</th>
                <th>委托日期</th>
                <th class="ops">操作</th>
              </tr>
            </thead>
            <tbody>
              @if (items().length === 0) {
                <tr>
                  <td colspan="7" class="empty">（无数据）</td>
                </tr>
              }
              @for (c of items(); track c.id) {
                <tr data-fn="M02.F01.I01">
                  <td class="mono">{{ c.contractCode }}</td>
                  <td>{{ c.projectName }}</td>
                  <td>{{ c.clientUnit }}</td>
                  <td>{{ c.witness }}</td>
                  <td>
                    <span class="badge" [class.archived]="c.status !== 'active'">{{
                      c.status === "active" ? "在用" : "已归档"
                    }}</span>
                  </td>
                  <td class="muted-xs">{{ c.entrustedDate ?? "—" }}</td>
                  <td class="ops">
                    <button mat-button (click)="openEdit(c)">编辑</button>
                    <button
                      mat-button
                      class="danger"
                      (click)="askDelete(c)"
                      data-fn="M02.F01.I03"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
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
      h1 {
        font-size: 1.5rem;
        margin: 0;
      }
      .desc {
        font-size: 0.875rem;
        color: #64748b;
        margin: 0.25rem 0 0;
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .toolbar {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }
      .status-select {
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
        background: #dcfce7;
        padding: 0.125rem 0.5rem;
        font-size: 0.75rem;
        color: #15803d;
      }
      .badge.archived {
        background: #e2e8f0;
        color: #475569;
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
export class ContractsListComponent {
  private readonly api = inject(ContractsService);
  private readonly dialog = inject(MatDialog);

  readonly items = signal<Contract[]>([]);
  readonly total = signal(0);
  readonly status = signal("");
  readonly keyword = signal("");
  // B6 加载态：首屏即视为加载中（首帧不渲染空表壳；refetch 走 per-widget 加载中）
  readonly loading = signal(true);
  readonly mode = signal<Mode>({ kind: "idle" });
  readonly deleteTarget = signal<Contract | null>(null);

  constructor() {
    // B6 加载态：首屏取数触发器在门控之前（react loadTriggered 同款防死锁）
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.api.contractsListContracts(
          compactParams({
            page: 1,
            pageSize: 50,
            status: (this.status() || undefined) as ContractStatus | undefined,
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

  openCreate(): void {
    void this.openForm(null);
  }

  openEdit(c: Contract): void {
    void this.openForm(c);
  }

  private async openForm(editing: Contract | null): Promise<void> {
    const ref = this.dialog.open(ContractFormDialogComponent, {
      width: "44rem",
      data: { editing },
    });
    const saved = (await firstValueFrom(ref.afterClosed())) as boolean | undefined;
    if (saved) {
      await this.load();
    }
  }

  askDelete(c: Contract): void {
    const ref = this.dialog.open(ContractConfirmDialogComponent, {
      width: "26rem",
      data: { code: c.contractCode },
    });
    void firstValueFrom(ref.afterClosed()).then(async (ok) => {
      if (!ok) return;
      try {
        await firstValueFrom(this.api.contractsDeleteContract(c.id));
        await this.load();
      } catch (err) {
        // react toast.error 语义等价：错误可见不吞
        console.error("delete failed:", err);
      }
    });
  }
}

/** 表单弹窗（新建/编辑共用 16 字段 + 状态 select；react ContractFormBody 1:1）。 */
@Component({
  selector: "app-contract-form-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ data.editing ? "编辑合同 " + data.editing.contractCode : "新建合同" }}
    </h2>
    <mat-dialog-content>
      <p class="desc">
        @if (data.editing) {
          修改合同字段后保存。
        } @else {
          创建一条合同记录（带 * 字段必填）。
        }
      </p>
      @if (saveError(); as err) {
        <div role="alert" class="save-error">{{ err }}</div>
      }
      <div class="grid2">
        <mat-form-field>
          <mat-label>合同编号 *</mat-label>
          <input matInput name="contractCode" [(ngModel)]="body.contractCode" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>委托单位 *</mat-label>
          <input matInput name="clientUnit" [(ngModel)]="body.clientUnit" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>项目名称 *</mat-label>
          <input matInput name="projectName" [(ngModel)]="body.projectName" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>项目地点</mat-label>
          <input matInput name="projectLocation" [(ngModel)]="body.projectLocation" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>施工单位 *</mat-label>
          <input matInput name="constructionUnit" [(ngModel)]="body.constructionUnit" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>检测专项</mat-label>
          <input
            matInput
            name="inspectionSpecialtyCode"
            [(ngModel)]="body.inspectionSpecialtyCode"
          />
        </mat-form-field>
        <mat-form-field>
          <mat-label>建设单位</mat-label>
          <input matInput name="buildingUnit" [(ngModel)]="body.buildingUnit" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>监理单位</mat-label>
          <input matInput name="supervisorUnit" [(ngModel)]="body.supervisorUnit" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>检测人</mat-label>
          <input matInput name="inspectionPerson" [(ngModel)]="body.inspectionPerson" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>检测人电话</mat-label>
          <input matInput name="inspectionPhone" [(ngModel)]="body.inspectionPhone" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>见证单位 *</mat-label>
          <input matInput name="witnessUnit" [(ngModel)]="body.witnessUnit" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>见证人 *</mat-label>
          <input matInput name="witness" [(ngModel)]="body.witness" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>见证人电话</mat-label>
          <input matInput name="witnessPhone" [(ngModel)]="body.witnessPhone" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>联系人</mat-label>
          <input matInput name="contactPerson" [(ngModel)]="body.contactPerson" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>联系人电话</mat-label>
          <input matInput name="contactPhone" [(ngModel)]="body.contactPhone" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>委托日期 (YYYY-MM-DD)</mat-label>
          <input matInput name="entrustedDate" [(ngModel)]="body.entrustedDate" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>状态</mat-label>
          <mat-select name="status" [(ngModel)]="body.status">
            <mat-option value="active">在用</mat-option>
            <mat-option value="archived">已归档</mat-option>
          </mat-select>
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">取消</button>
      <!-- @entry M02.F01.I02 表单内保存（新建/编辑共用同一按钮） -->
      <button mat-button (click)="submit()" data-fn="M02.F01.I02">
        {{ data.editing ? "保存" : "创建" }}
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
    `,
  ],
})
export class ContractFormDialogComponent {
  readonly data: { editing: Contract | null } = inject(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<ContractFormDialogComponent, boolean>>(MatDialogRef);

  private readonly api = inject(ContractsService);

  readonly saveError = signal<string | null>(null);

  readonly body: ContractBody = this.data.editing
    ? {
        contractCode: this.data.editing.contractCode,
        clientUnit: this.data.editing.clientUnit,
        projectName: this.data.editing.projectName,
        projectLocation: this.data.editing.projectLocation ?? "",
        constructionUnit: this.data.editing.constructionUnit,
        inspectionSpecialtyCode: this.data.editing.inspectionSpecialtyCode ?? "",
        buildingUnit: this.data.editing.buildingUnit ?? "",
        supervisorUnit: this.data.editing.supervisorUnit ?? "",
        inspectionPerson: this.data.editing.inspectionPerson ?? "",
        inspectionPhone: this.data.editing.inspectionPhone ?? "",
        witnessUnit: this.data.editing.witnessUnit,
        witness: this.data.editing.witness,
        witnessPhone: this.data.editing.witnessPhone ?? "",
        contactPerson: this.data.editing.contactPerson ?? "",
        contactPhone: this.data.editing.contactPhone ?? "",
        entrustedDate: this.data.editing.entrustedDate ?? "",
        status: this.data.editing.status,
      }
    : { ...EMPTY_BODY };

  async submit(): Promise<void> {
    this.saveError.set(null);
    try {
      if (this.data.editing) {
        // react 同款：update 整 body 透传（含 contractCode），id 寻址
        await firstValueFrom(
          this.api.contractsUpdateContract(this.data.editing.id, this.body),
        );
      } else {
        await firstValueFrom(this.api.contractsCreateContract(this.body));
      }
      this.ref.close(true);
    } catch (err) {
      this.saveError.set((err as { message?: string }).message || "保存失败");
    }
  }
}

/** 删除确认弹窗（react ConfirmModal 等价：标题「删除合同」）。 */
@Component({
  selector: "app-contract-confirm-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>删除合同</h2>
    <mat-dialog-content>
      <p>确认删除合同 {{ data.code }}？此操作不可撤销。</p>
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
export class ContractConfirmDialogComponent {
  readonly data: { code: string } = inject(MAT_DIALOG_DATA);
  readonly ref =
    inject<MatDialogRef<ContractConfirmDialogComponent, boolean>>(MatDialogRef);
}
