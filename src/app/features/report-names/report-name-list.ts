// M06.F07 报告名称维护 — 列表 + MatDialog 弹窗（基础信息 + extFields 模板）。
// 移植自 lab-management-system-react/src/features/report-names/ReportNameList.tsx
//（REQ-2026-031 L-T1③，行为 1:1；react Dialog → MatDialog，toast → 弹窗内错误条）。
//
// 简化版（对齐 nextjs REF，单 Tab 而非 5 Tab）：
//   - 顶部筛选条（keyword input，Enter/搜索按钮触发）
//   - 表格：编码 / 简称 / 全称 / 模板路径 / 排序
//   - extFields 是 JSON 数组字符串（textarea 输入），保存时 JSON.parse
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
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { firstValueFrom } from "rxjs";

import { PageLoadingComponent } from "../../ui/page-loading.component";
import { ReportNamesService } from "../../../api/endpoints/report-names/report-names.service";
import { compactParams } from "../../../api/params";
import type { InspectionReportName } from "../../../api/endpoints/model/inspectionReportName";
import type { ExtFieldDef } from "../../../api/endpoints/model/extFieldDef";
import { ReportNameLinkDialogComponent } from "./report-name-link-dialog";

/** 表单体：extFieldsText 是 textarea 里的 JSON 数组字符串。 */
interface ReportNameBody {
  code: string;
  name: string;
  fullName: string;
  templatePath: string;
  description: string;
  sortOrder: string;
  extFieldsText: string;
}

@Component({
  selector: "app-report-name-form-dialog",
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
      {{ data.editing ? "编辑报告名称 " + data.editing.code : "新建报告名称" }}
    </h2>
    <mat-dialog-content>
      <p class="desc">
        @if (data.editing) {
          修改字段后保存。
        } @else {
          创建一条报告名称记录。extFields 为 JSON 数组格式，例如
          <code>[&#123;key:"x",label:"X"&#125;]</code>。
        }
      </p>
      @if (saveError(); as err) {
        <div role="alert" class="save-error">{{ err }}</div>
      }
      <div class="grid2">
        <mat-form-field>
          <mat-label>编码 *</mat-label>
          <input matInput name="code" [(ngModel)]="body.code" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>简称 *</mat-label>
          <input matInput name="name" [(ngModel)]="body.name" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>全称</mat-label>
          <input matInput name="fullName" [(ngModel)]="body.fullName" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>模板路径</mat-label>
          <input matInput name="templatePath" [(ngModel)]="body.templatePath" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>排序</mat-label>
          <input matInput name="sortOrder" type="number" [(ngModel)]="body.sortOrder" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>描述</mat-label>
          <input matInput name="description" [(ngModel)]="body.description" />
        </mat-form-field>
      </div>
      <mat-form-field>
        <mat-label>扩展属性 extFields（JSON 数组）</mat-label>
        <textarea
          matInput
          name="extFieldsText"
          class="mono"
          rows="6"
          [(ngModel)]="body.extFieldsText"
        ></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">取消</button>
      <button mat-button (click)="submit()" data-fn="M06.F07.I01">
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
      }
      mat-form-field {
        width: 100%;
      }
      .mono {
        font-family: ui-monospace, monospace;
        font-size: 0.75rem;
      }
    `,
  ],
})
export class ReportNameFormDialogComponent {
  readonly data: { editing: InspectionReportName | null } = inject(MAT_DIALOG_DATA);
  readonly ref =
    inject<MatDialogRef<ReportNameFormDialogComponent, boolean>>(MatDialogRef);

  private readonly api = inject(ReportNamesService);

  readonly saveError = signal<string | null>(null);

  body: ReportNameBody = this.data.editing
    ? {
        code: this.data.editing.code,
        name: this.data.editing.name,
        fullName: this.data.editing.fullName ?? "",
        templatePath: this.data.editing.templatePath ?? "",
        description: this.data.editing.description ?? "",
        sortOrder: String(this.data.editing.sortOrder ?? 0),
        extFieldsText: JSON.stringify(this.data.editing.extFields ?? [], null, 2),
      }
    : {
        code: "",
        name: "",
        fullName: "",
        templatePath: "",
        description: "",
        sortOrder: "0",
        extFieldsText: "[]",
      };

  /** extFields 解析 + 提交；解析失败/接口失败留在弹窗并显示错误（react toast 语义）。 */
  async submit(): Promise<void> {
    this.saveError.set(null);
    let extFields: ExtFieldDef[];
    try {
      const v: unknown = JSON.parse(this.body.extFieldsText);
      if (!Array.isArray(v)) {
        this.saveError.set("extFields 必须是 JSON 数组");
        return;
      }
      extFields = v as ExtFieldDef[];
    } catch (e) {
      this.saveError.set(`extFields 解析失败：${(e as Error).message}`);
      return;
    }
    const payload = {
      code: this.body.code,
      name: this.body.name,
      fullName: this.body.fullName || undefined,
      templatePath: this.body.templatePath || undefined,
      description: this.body.description || undefined,
      sortOrder: Number(this.body.sortOrder) || 0,
      extFields,
    };
    try {
      if (this.data.editing) {
        const { code, ...update } = payload;
        await firstValueFrom(this.api.reportNamesUpdateReportName(code, update));
      } else {
        await firstValueFrom(this.api.reportNamesCreateReportName(payload));
      }
      this.ref.close(true);
    } catch (err) {
      this.saveError.set((err as { message?: string })?.message ?? "保存失败");
    }
  }
}

/** 删除确认弹窗（react ConfirmModal 等价）。 */
@Component({
  selector: "app-report-name-confirm-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>删除报告名称</h2>
    <mat-dialog-content>
      <p>确认删除报告名称 {{ data.code }}？此操作不可撤销。</p>
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
export class ReportNameConfirmDialogComponent {
  readonly data: { code: string } = inject(MAT_DIALOG_DATA);
  readonly ref =
    inject<MatDialogRef<ReportNameConfirmDialogComponent, boolean>>(MatDialogRef);
}

@Component({
  selector: "app-report-name-list",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    PageLoadingComponent,
  ],
  template: `
    <div class="page" data-fn="M06.F07.I01">
      @if (loading() && items().length === 0) {
        <app-page-loading />
      } @else {
        <div class="header">
          <div>
            <h1>报告名称维护</h1>
            <p class="desc">M06.F07 报告名称 + extFields 模板</p>
          </div>
          <button mat-button (click)="openCreate()" data-fn="M06.F07.I01">
            新建报告名称
          </button>
        </div>

        <div class="toolbar">
          <mat-form-field class="w56">
            <mat-label>搜索</mat-label>
            <input
              matInput
              placeholder="按编码 / 名称搜索"
              [value]="keyword()"
              (input)="keyword.set($any($event.target).value)"
              (keyup.enter)="load()"
            />
          </mat-form-field>
          <button mat-button (click)="load()">搜索</button>
        </div>

        <div class="card">
          <div class="card-head">
            <h3>报告名称列表（{{ total() || "…" }}）</h3>
            @if (loading()) {
              <span class="muted-xs">加载中…</span>
            }
          </div>
          <table>
            <thead>
              <tr>
                <th>编码</th>
                <th>简称</th>
                <th>全称</th>
                <th>模板</th>
                <th>排序</th>
                <th class="ops">操作</th>
              </tr>
            </thead>
            <tbody>
              @if (items().length === 0) {
                <tr>
                  <td colspan="6" class="empty">（无数据）</td>
                </tr>
              }
              @for (r of items(); track r.code) {
                <tr data-fn="M06.F07.I01">
                  <td class="mono">{{ r.code }}</td>
                  <td>{{ r.name }}</td>
                  <td>{{ r.fullName ?? "—" }}</td>
                  <td class="mono">{{ r.templatePath ?? "—" }}</td>
                  <td class="muted-xs">{{ r.sortOrder }}</td>
                  <td class="ops">
                    <button mat-button (click)="openLink(r)" data-fn="M06.F07.I02">
                      关联
                    </button>
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
export class ReportNameListComponent {
  private readonly api = inject(ReportNamesService);
  private readonly dialog = inject(MatDialog);

  readonly items = signal<InspectionReportName[]>([]);
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
        this.api.reportNamesListReportNames(
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

  openEdit(r: InspectionReportName): void {
    void this.openForm(r);
  }

  private async openForm(editing: InspectionReportName | null): Promise<void> {
    const ref = this.dialog.open(ReportNameFormDialogComponent, {
      width: "36rem",
      data: { editing },
    });
    const saved = (await firstValueFrom(ref.afterClosed())) as boolean | undefined;
    if (saved) {
      await this.load();
    }
  }

  askDelete(r: InspectionReportName): void {
    const ref = this.dialog.open(ReportNameConfirmDialogComponent, {
      width: "26rem",
      data: { code: r.code },
    });
    void firstValueFrom(ref.afterClosed()).then(async (ok) => {
      if (!ok) return;
      try {
        await firstValueFrom(this.api.reportNamesDeleteReportName(r.code));
        await this.load();
      } catch (err) {
        // react toast.error 语义等价：错误可见不吞
        console.error("delete failed:", err);
      }
    });
  }

  /** M06.F07.I02 报告名称↔标准/参数关联弹窗。 */
  openLink(r: InspectionReportName): void {
    const ref = this.dialog.open(ReportNameLinkDialogComponent, {
      width: "44rem",
      data: {
        reportNameCode: r.code,
        reportNameLabel: r.name,
        onChanged: () => {
          void this.load();
        },
      },
    });
    void firstValueFrom(ref.afterClosed()).then(() => {
      void this.load();
    });
  }
}
