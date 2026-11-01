// M06.F06 技术要求维护 — 列表 + 多维筛选 + MatDialog 弹窗。
// 移植自 lab-management-system-react/src/features/inspection-capability/TechnicalRequirementList.tsx
//（REQ-2026-031 L-T1②，行为 1:1；react Dialog → MatDialog）。
//
// 复合主键：(inspectionObjectCode, inspectionParameterCode, judgmentStandardCode)——
// 契约 PUT/DELETE 三段组合键寻址，无 id 列；
// 多维筛选：brand / model / grade / spec（M06.F06.I01）——契约 list 无该四维参数，
// 客户端二次过滤。
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  type Signal,
} from "@angular/core";
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
import { MatSelectModule } from "@angular/material/select";
import { firstValueFrom } from "rxjs";

import { PageLoadingComponent } from "../../ui/page-loading.component";
import { EmptyStateComponent } from "../../ui/empty-state.component";
import { TechnicalRequirementsService } from "../../../api/endpoints/technical-requirements/technical-requirements.service";
import { InspectionDictionaryService } from "../../../api/endpoints/inspection-dictionary/inspection-dictionary.service";
import { compactParams } from "../../../api/params";
import type { TechnicalRequirement } from "../../../api/endpoints/model/technicalRequirement";
import type { RequirementComparison } from "../../../api/endpoints/model/requirementComparison";

/** 行结构 = 契约 TechnicalRequirement（三段组合键寻址，无 id）。 */
type TechReq = TechnicalRequirement;

interface Opt {
  code: string;
  name: string;
}

const COMPARISONS = ["≥", "≤", "=", "range", "eq"];
const COMPARISON_LABEL: Record<string, string> = {
  "≥": "≥",
  "≤": "≤",
  "=": "=",
  range: "区间",
  eq: "等于",
};

const EMPTY_FORM: Record<string, string> = {
  inspectionObjectCode: "",
  inspectionParameterCode: "",
  judgmentStandardCode: "",
  brand: "",
  model: "",
  grade: "",
  spec: "",
  minValue: "",
  maxValue: "",
  comparison: "≥",
  remark: "",
};

@Component({
  selector: "app-tech-req-form-dialog",
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
    <h2 mat-dialog-title>{{ data.editing ? "编辑技术要求" : "新建技术要求" }}</h2>
    <mat-dialog-content>
      <p class="desc">
        复合主键：检测项目 + 检测参数 + 判定标准；引用保护由 M06.F06.I05 兜底
      </p>
      @if (data.saveError) {
        <div role="alert" class="save-error">{{ data.saveError }}</div>
      }
      <div class="grid2">
        <mat-form-field>
          <mat-label>检测项目</mat-label>
          <mat-select
            name="inspectionObjectCode"
            [(ngModel)]="form['inspectionObjectCode']"
          >
            <mat-option value="">未选择</mat-option>
            @for (o of data.objects; track o.code) {
              <mat-option [value]="o.code">{{ o.code }} {{ o.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>检测参数</mat-label>
          <mat-select
            name="inspectionParameterCode"
            [(ngModel)]="form['inspectionParameterCode']"
          >
            <mat-option value="">未选择</mat-option>
            @for (p of data.parameters; track p.code) {
              <mat-option [value]="p.code">{{ p.code }} {{ p.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>
      <mat-form-field>
        <mat-label>判定标准</mat-label>
        <input
          matInput
          name="judgmentStandardCode"
          [(ngModel)]="form['judgmentStandardCode']"
          placeholder="如 GB 175-2023"
          class="mono"
        />
      </mat-form-field>
      <div class="grid2">
        <mat-form-field>
          <mat-label>牌号</mat-label>
          <input matInput name="brand" [(ngModel)]="form['brand']" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>型号</mat-label>
          <input matInput name="model" [(ngModel)]="form['model']" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>等级</mat-label>
          <input matInput name="grade" [(ngModel)]="form['grade']" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>规格</mat-label>
          <input matInput name="spec" [(ngModel)]="form['spec']" />
        </mat-form-field>
      </div>
      <div class="grid3">
        <mat-form-field>
          <mat-label>判定方式</mat-label>
          <mat-select name="comparison" [(ngModel)]="form['comparison']">
            @for (c of COMPARISONS; track c) {
              <mat-option [value]="c">{{ label(c) }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>下限</mat-label>
          <input matInput name="minValue" type="number" [(ngModel)]="form['minValue']" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>上限</mat-label>
          <input matInput name="maxValue" type="number" [(ngModel)]="form['maxValue']" />
        </mat-form-field>
      </div>
      <mat-form-field>
        <mat-label>备注</mat-label>
        <input matInput name="remark" [(ngModel)]="form['remark']" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">取消</button>
      <button mat-button (click)="save()">保存</button>
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
      .grid3 {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
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
export class TechReqFormDialogComponent {
  readonly data: {
    editing: TechReq | null;
    objects: Opt[];
    parameters: Opt[];
    saveError: string | null;
    form: Record<string, string>;
  } = inject(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<TechReqFormDialogComponent, boolean>>(MatDialogRef);

  readonly COMPARISONS = COMPARISONS;
  form = this.data.form;

  label(c: string): string {
    return COMPARISON_LABEL[c] ?? c;
  }

  cancel(): void {
    this.ref.close(false);
  }

  save(): void {
    this.ref.close(true);
  }
}

@Component({
  selector: "app-technical-requirement-list",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDialogModule,
    PageLoadingComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="page" data-fn="M06.F06.I01">
      @if (loading() && items().length === 0) {
        <app-page-loading />
      } @else {
        <div class="card">
          <h2>技术要求维护</h2>
          <p class="desc">
            M06.F06 技术要求 — 四维度匹配：牌号 / 型号 / 等级 / 规格（brand × model ×
            grade × spec）
          </p>

          <div class="toolbar">
            <mat-form-field class="w32">
              <mat-label>牌号</mat-label>
              <input
                matInput
                aria-label="牌号筛选"
                placeholder="牌号"
                [value]="brandFilter()"
                (input)="brandFilter.set($any($event.target).value)"
              />
            </mat-form-field>
            <mat-form-field class="w32">
              <mat-label>型号</mat-label>
              <input
                matInput
                aria-label="型号筛选"
                placeholder="型号"
                [value]="modelFilter()"
                (input)="modelFilter.set($any($event.target).value)"
              />
            </mat-form-field>
            <mat-form-field class="w32">
              <mat-label>等级</mat-label>
              <input
                matInput
                aria-label="等级筛选"
                placeholder="等级"
                [value]="gradeFilter()"
                (input)="gradeFilter.set($any($event.target).value)"
              />
            </mat-form-field>
            <mat-form-field class="w32">
              <mat-label>规格</mat-label>
              <input
                matInput
                aria-label="规格筛选"
                placeholder="规格"
                [value]="specFilter()"
                (input)="specFilter.set($any($event.target).value)"
              />
            </mat-form-field>
            <button mat-button (click)="openCreate()" data-fn="M06.F06.I02">
              <mat-icon>add</mat-icon>
              新建技术要求
            </button>
          </div>

          @if (error(); as err) {
            <div role="alert" class="alert">{{ err }}</div>
          }

          @if (items().length === 0) {
            <app-empty-state title="暂无技术要求" description="点击右上角新建一条" />
          } @else {
            <table>
              <thead>
                <tr>
                  <th>检测项目</th>
                  <th>检测参数</th>
                  <th>判定标准</th>
                  <th>牌号</th>
                  <th>型号</th>
                  <th>等级</th>
                  <th>规格</th>
                  <th>判定方式</th>
                  <th>上限</th>
                  <th>下限</th>
                  <th class="w32">操作</th>
                </tr>
              </thead>
              <tbody>
                @for (
                  row of items();
                  track row.inspectionObjectCode +
                    "/" +
                    row.inspectionParameterCode +
                    "/" +
                    row.judgmentStandardCode +
                    "|" +
                    (row.brand ?? "") +
                    "|" +
                    (row.model ?? "") +
                    "|" +
                    (row.grade ?? "") +
                    "|" +
                    (row.spec ?? "")
                ) {
                  <tr>
                    <td class="mono">{{ row.inspectionObjectCode }}</td>
                    <td class="mono">{{ row.inspectionParameterCode }}</td>
                    <td class="mono">{{ row.judgmentStandardCode }}</td>
                    <td>{{ row.brand ?? "-" }}</td>
                    <td>{{ row.model ?? "-" }}</td>
                    <td>{{ row.grade ?? "-" }}</td>
                    <td>{{ row.spec ?? "-" }}</td>
                    <td>
                      <span class="badge outline">{{
                        comparisonLabel(row.comparison)
                      }}</span>
                    </td>
                    <td>{{ row.maxValue ?? "-" }}</td>
                    <td>{{ row.minValue ?? "-" }}</td>
                    <td class="ops">
                      <button
                        mat-button
                        (click)="openEdit(row)"
                        data-fn="M06.F06.I02"
                        [attr.aria-label]="
                          '编辑 ' +
                          row.inspectionObjectCode +
                          '/' +
                          row.inspectionParameterCode +
                          '/' +
                          row.judgmentStandardCode
                        "
                      >
                        编辑
                      </button>
                      <button
                        mat-button
                        class="danger"
                        (click)="askDelete(row)"
                        data-fn="M06.F06.I05"
                        [attr.aria-label]="
                          '删除 ' +
                          row.inspectionObjectCode +
                          '/' +
                          row.inspectionParameterCode +
                          '/' +
                          row.judgmentStandardCode
                        "
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }

          <div class="muted">共 {{ items().length }} 条</div>
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
      }
      .card {
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .desc {
        font-size: 0.875rem;
        color: #64748b;
        margin: 0;
      }
      .toolbar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .alert {
        color: #dc2626;
        background: #fef2f2;
        padding: 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.875rem;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
      }
      th,
      td {
        border-bottom: 1px solid #e2e8f0;
        padding: 0.4rem 0.6rem;
        text-align: left;
      }
      .mono {
        font-family: ui-monospace, monospace;
        font-size: 0.75rem;
      }
      .muted {
        font-size: 0.875rem;
        color: #64748b;
      }
      .badge.outline {
        border: 1px solid #cbd5e1;
        border-radius: 9999px;
        padding: 0.05rem 0.5rem;
        font-size: 0.75rem;
      }
      button.danger {
        color: #dc2626;
      }
      .w32 {
        width: 8rem;
      }
    `,
  ],
})
export class TechnicalRequirementListComponent {
  private readonly api = inject(TechnicalRequirementsService);
  private readonly dict = inject(InspectionDictionaryService);
  private readonly dialog = inject(MatDialog);

  readonly items = signal<TechReq[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly objects = signal<Opt[]>([]);
  readonly parameters = signal<Opt[]>([]);

  readonly brandFilter = signal("");
  readonly modelFilter = signal("");
  readonly gradeFilter = signal("");
  readonly specFilter = signal("");

  readonly deleting = signal<TechReq | null>(null);
  readonly deletingBusy = signal(false);
  readonly deleteError = signal<string | null>(null);

  constructor() {
    effect(() => {
      void firstValueFrom(
        this.dict.inspectionDictionaryListObjects(
          compactParams({ page: 1, pageSize: 500 }),
        ),
      )
        .then((r) => this.objects.set(r.items ?? []))
        .catch(() => undefined);
    });
    effect(() => {
      void firstValueFrom(
        this.dict.inspectionDictionaryListParameters(
          compactParams({ page: 1, pageSize: 500 }),
        ),
      )
        .then((r) => this.parameters.set(r.items ?? []))
        .catch(() => undefined);
    });
    // 契约 list 参数无 brand/model/grade/spec 维度——客户端按四维二次过滤
    effect(() => {
      this.brandFilter();
      this.modelFilter();
      this.gradeFilter();
      this.specFilter();
      void this.load();
    });
  }

  comparisonLabel(c: string): string {
    return COMPARISON_LABEL[c] ?? c;
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.api.technicalRequirementsListTechnicalRequirements(),
      );
      const all = Array.isArray(res) ? res : [];
      const brand = this.brandFilter();
      const model = this.modelFilter();
      const grade = this.gradeFilter();
      const spec = this.specFilter();
      const filtered = all.filter((it) => {
        if (brand && (it.brand ?? "") !== brand) return false;
        if (model && (it.model ?? "") !== model) return false;
        if (grade && (it.grade ?? "") !== grade) return false;
        if (spec && (it.spec ?? "") !== spec) return false;
        return true;
      });
      this.items.set(filtered);
    } catch (err) {
      this.error.set((err as { message?: string })?.message ?? "加载失败");
      this.items.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    void this.openForm(null);
  }

  openEdit(row: TechReq): void {
    void this.openForm(row);
  }

  private async openForm(editing: TechReq | null): Promise<void> {
    const form: Record<string, string> = editing
      ? {
          inspectionObjectCode: editing.inspectionObjectCode,
          inspectionParameterCode: editing.inspectionParameterCode,
          judgmentStandardCode: editing.judgmentStandardCode,
          brand: editing.brand ?? "",
          model: editing.model ?? "",
          grade: editing.grade ?? "",
          spec: editing.spec ?? "",
          minValue: editing.minValue != null ? String(editing.minValue) : "",
          maxValue: editing.maxValue != null ? String(editing.maxValue) : "",
          comparison: editing.comparison ?? "≥",
          remark: editing.remark ?? "",
        }
      : { ...EMPTY_FORM };
    const ref = this.dialog.open(TechReqFormDialogComponent, {
      width: "42rem",
      data: {
        editing,
        objects: this.objects(),
        parameters: this.parameters(),
        saveError: null as string | null,
        form,
      },
    });
    const saved = (await firstValueFrom(ref.afterClosed())) as boolean | undefined;
    if (saved) {
      await this.save(editing, form);
    }
  }

  private async save(
    editing: TechReq | null,
    form: Record<string, string>,
  ): Promise<void> {
    const payload = {
      inspectionObjectCode: form["inspectionObjectCode"] ?? "",
      inspectionParameterCode: form["inspectionParameterCode"] ?? "",
      judgmentStandardCode: form["judgmentStandardCode"] ?? "",
      brand: form["brand"] || undefined,
      model: form["model"] || undefined,
      grade: form["grade"] || undefined,
      spec: form["spec"] || undefined,
      minValue: form["minValue"] === "" ? undefined : Number(form["minValue"]),
      maxValue: form["maxValue"] === "" ? undefined : Number(form["maxValue"]),
      comparison: form["comparison"] as RequirementComparison,
      remark: form["remark"] || undefined,
    };
    try {
      if (editing) {
        await firstValueFrom(
          this.api.technicalRequirementsUpdateTechnicalRequirement(
            editing.inspectionObjectCode,
            editing.inspectionParameterCode,
            editing.judgmentStandardCode,
            payload,
          ),
        );
      } else {
        await firstValueFrom(
          this.api.technicalRequirementsCreateTechnicalRequirement(payload),
        );
      }
      await this.load();
    } catch (err) {
      // 保存失败把错误带回弹窗（react toast 语义等价：错误可见不吞）
      console.error("save failed:", err);
      const msg = (err as { error?: { message?: string } })?.error?.message ?? "保存失败";
      const ref = this.dialog.open(TechReqFormDialogComponent, {
        width: "42rem",
        data: {
          editing,
          objects: this.objects(),
          parameters: this.parameters(),
          saveError: msg,
          form,
        },
      });
      const saved = (await firstValueFrom(ref.afterClosed())) as boolean | undefined;
      if (saved) await this.save(editing, form);
    }
  }

  /** 删除确认弹窗（react ConfirmModal 语义 1:1，M06.F06.I05 引用保护文案）。 */
  askDelete(row: TechReq): void {
    this.deleting.set(row);
    this.deleteError.set(null);
    const ref = this.dialog.open(TechReqConfirmDialogComponent, {
      width: "28rem",
      data: {
        objectCode: row.inspectionObjectCode,
        parameterCode: row.inspectionParameterCode,
        deleteError: this.deleteError as Signal<string | null>,
      },
    });
    void firstValueFrom(ref.afterClosed()).then((ok) => {
      if (ok) {
        void this.confirmDelete();
      } else {
        this.deleting.set(null);
        this.deleteError.set(null);
      }
    });
  }

  async confirmDelete(): Promise<void> {
    const target = this.deleting();
    if (!target) return;
    this.deletingBusy.set(true);
    this.deleteError.set(null);
    try {
      await firstValueFrom(
        this.api.technicalRequirementsDeleteTechnicalRequirement(
          target.inspectionObjectCode,
          target.inspectionParameterCode,
          target.judgmentStandardCode,
        ),
      );
      this.deleting.set(null);
      await this.load();
    } catch (err) {
      this.deleteError.set(
        (err as { error?: { message?: string } })?.error?.message ?? "删除失败",
      );
    } finally {
      this.deletingBusy.set(false);
    }
  }
}

/** 删除确认小弹窗（react ConfirmModal 等价：确认 true / 取消 false）。 */
@Component({
  selector: "app-tech-req-confirm-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>删除技术要求</h2>
    <mat-dialog-content>
      <p>
        确定删除 <span class="mono">{{ data.objectCode }}/{{ data.parameterCode }}</span>
        的技术要求？被引用的技术要求不可删除（M06.F06.I05 引用保护）。
      </p>
      @if (data.deleteError(); as err) {
        <div role="alert" class="del-error">{{ err }}</div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">取消</button>
      <button mat-button class="danger" (click)="ref.close(true)">确定删除</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .mono {
        font-family: ui-monospace, monospace;
        font-size: 0.75rem;
      }
      .del-error {
        margin-top: 0.5rem;
        color: #dc2626;
        font-size: 0.875rem;
      }
      button.danger {
        color: #dc2626;
      }
    `,
  ],
})
export class TechReqConfirmDialogComponent {
  readonly data: {
    objectCode: string;
    parameterCode: string;
    deleteError: Signal<string | null>;
  } = inject(MAT_DIALOG_DATA);
  readonly ref =
    inject<MatDialogRef<TechReqConfirmDialogComponent, boolean>>(MatDialogRef);
}
