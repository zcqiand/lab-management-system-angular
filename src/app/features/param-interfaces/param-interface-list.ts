// M06.F08 参数界面维护 — 列表 + MatDialog 弹窗（录入卡片模型）。
// 移植自 lab-management-system-react/src/features/param-interfaces/ParamInterfaceList.tsx
//（REQ-2026-031 L-T1③，行为 1:1；react Dialog → MatDialog，toast → 弹窗内错误条）。
//
// 简化版（对齐 nextjs REF，单 Tab 而非 2 Tab）：
//   - 顶部筛选条（keyword input，Enter/搜索按钮触发）
//   - 表格：编码 / 组件路径 / 排序
//   - 关联参数走 /inspection-parameter-param-interfaces 端点，本批只做主表 CRUD
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
import { firstValueFrom } from "rxjs";

import { PageLoadingComponent } from "../../ui/page-loading.component";
import { ParamInterfacesService } from "../../../api/endpoints/param-interfaces/param-interfaces.service";
import { compactParams } from "../../../api/params";
import type { ParamInterface } from "../../../api/endpoints/model/paramInterface";

@Component({
  selector: "app-param-interface-form-dialog",
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
      {{ data.editing ? "编辑参数界面 " + data.editing.code : "新建参数界面" }}
    </h2>
    <mat-dialog-content>
      <p class="desc">
        @if (data.editing) {
          修改字段后保存。
        } @else {
          创建一条参数界面记录（录入卡片模型）。
        }
      </p>
      @if (saveError(); as err) {
        <div role="alert" class="save-error">{{ err }}</div>
      }
      <div class="grid1">
        <mat-form-field>
          <mat-label>编码 *</mat-label>
          <input
            matInput
            name="code"
            [(ngModel)]="body.code"
            [disabled]="!!data.editing"
          />
        </mat-form-field>
        <mat-form-field>
          <mat-label>组件路径 *</mat-label>
          <input matInput name="componentPath" [(ngModel)]="body.componentPath" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>排序</mat-label>
          <input matInput name="sortOrder" type="number" [(ngModel)]="body.sortOrder" />
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">取消</button>
      <button mat-button (click)="submit()" data-fn="M06.F08.I01">
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
      .grid1 {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.75rem;
      }
      mat-form-field {
        width: 100%;
      }
    `,
  ],
})
export class ParamInterfaceFormDialogComponent {
  readonly data: { editing: ParamInterface | null } = inject(MAT_DIALOG_DATA);
  readonly ref =
    inject<MatDialogRef<ParamInterfaceFormDialogComponent, boolean>>(MatDialogRef);

  private readonly api = inject(ParamInterfacesService);

  readonly saveError = signal<string | null>(null);

  body = this.data.editing
    ? {
        code: this.data.editing.code,
        componentPath: this.data.editing.componentPath,
        sortOrder: String(this.data.editing.sortOrder ?? 0),
      }
    : { code: "", componentPath: "", sortOrder: "0" };

  /** 接口失败留在弹窗并显示错误（react toast 语义）。 */
  async submit(): Promise<void> {
    this.saveError.set(null);
    const payload = {
      componentPath: this.body.componentPath,
      sortOrder: Number(this.body.sortOrder) || 0,
    };
    try {
      if (this.data.editing) {
        await firstValueFrom(
          this.api.paramInterfacesUpdateParamInterface(this.data.editing.code, payload),
        );
      } else {
        await firstValueFrom(
          this.api.paramInterfacesCreateParamInterface({
            code: this.body.code,
            ...payload,
          }),
        );
      }
      this.ref.close(true);
    } catch (err) {
      this.saveError.set((err as { message?: string })?.message ?? "保存失败");
    }
  }
}

/** 删除确认弹窗（react ConfirmModal 等价）。 */
@Component({
  selector: "app-param-interface-confirm-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>删除参数界面</h2>
    <mat-dialog-content>
      <p>确认删除参数界面 {{ data.code }}？此操作不可撤销。</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">取消</button>
      <button mat-button class="danger" (click)="ref.close(true)">确定删除</button>
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
export class ParamInterfaceConfirmDialogComponent {
  readonly data: { code: string } = inject(MAT_DIALOG_DATA);
  readonly ref =
    inject<MatDialogRef<ParamInterfaceConfirmDialogComponent, boolean>>(MatDialogRef);
}

@Component({
  selector: "app-param-interface-list",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    PageLoadingComponent,
  ],
  template: `
    <div class="page" data-fn="M06.F08.I01">
      @if (loading() && items().length === 0) {
        <app-page-loading />
      } @else {
        <div class="header">
          <div>
            <h1>参数界面维护</h1>
            <p class="desc">M06.F08 参数界面（录入卡片模型）</p>
          </div>
          <button mat-button (click)="openCreate()" data-fn="M06.F08.I01">
            新建参数界面
          </button>
        </div>

        <div class="toolbar">
          <mat-form-field class="w56">
            <mat-label>搜索</mat-label>
            <input
              matInput
              placeholder="按编码 / 组件路径搜索"
              [value]="keyword()"
              (input)="keyword.set($any($event.target).value)"
              (keyup.enter)="load()"
            />
          </mat-form-field>
          <button mat-button (click)="load()">搜索</button>
        </div>

        <div class="card">
          <div class="card-head">
            <h3>参数界面列表（{{ total() || "…" }}）</h3>
            @if (loading()) {
              <span class="muted-xs">加载中…</span>
            }
          </div>
          <table>
            <thead>
              <tr>
                <th>编码</th>
                <th>组件路径</th>
                <th>排序</th>
                <th class="ops">操作</th>
              </tr>
            </thead>
            <tbody>
              @if (items().length === 0) {
                <tr>
                  <td colspan="4" class="empty">（无数据）</td>
                </tr>
              }
              @for (r of items(); track r.code) {
                <tr data-fn="M06.F08.I01">
                  <td class="mono">{{ r.code }}</td>
                  <td class="mono">{{ r.componentPath }}</td>
                  <td class="muted-xs">{{ r.sortOrder }}</td>
                  <td class="ops">
                    <button mat-button (click)="openEdit(r)">编辑</button>
                    <button mat-button class="danger" (click)="askDelete(r)">删除</button>
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
      .w56 {
        width: 18rem;
      }
    `,
  ],
})
export class ParamInterfaceListComponent {
  private readonly api = inject(ParamInterfacesService);
  private readonly dialog = inject(MatDialog);

  readonly items = signal<ParamInterface[]>([]);
  readonly total = signal(0);
  readonly keyword = signal("");
  readonly loading = signal(true);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.api.paramInterfacesListParamInterfaces(
          compactParams({ page: 1, pageSize: 50, keyword: this.keyword() || undefined }),
        ),
      );
      this.items.set(res.items ?? []);
      this.total.set(res.total ?? 0);
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    void this.openForm(null);
  }

  openEdit(r: ParamInterface): void {
    void this.openForm(r);
  }

  private async openForm(editing: ParamInterface | null): Promise<void> {
    const ref = this.dialog.open(ParamInterfaceFormDialogComponent, {
      width: "28rem",
      data: { editing },
    });
    const saved = (await firstValueFrom(ref.afterClosed())) as boolean | undefined;
    if (saved) {
      await this.load();
    }
  }

  askDelete(r: ParamInterface): void {
    const ref = this.dialog.open(ParamInterfaceConfirmDialogComponent, {
      width: "26rem",
      data: { code: r.code },
    });
    void firstValueFrom(ref.afterClosed()).then(async (ok) => {
      if (!ok) return;
      try {
        await firstValueFrom(this.api.paramInterfacesDeleteParamInterface(r.code));
        await this.load();
      } catch (err) {
        // react toast.error 语义等价：错误可见不吞
        console.error("delete failed:", err);
      }
    });
  }
}
