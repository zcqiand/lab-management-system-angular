// M06.F05 计算方法维护 — 列表 + MatDialog 弹窗。
// 移植自 lab-management-system-react/src/features/inspection-capability/CalculationMethodList.tsx
//（REQ-2026-031 L-T1②，行为 1:1；react Dialog → MatDialog）。
//
// 复合主键：(inspectionObjectCode, inspectionParameterCode)——契约 PUT/DELETE
// /api/calculation-methods/{objectCode}/{parameterCode}（orval 组合键寻址，无 id 列）。
// 契约 list 无 keyword/page 参数（返回全量数组）——关键字搜索前端过滤。
import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
import { CalculationMethodsService } from "../../../api/endpoints/calculation-methods/calculation-methods.service";
import { InspectionDictionaryService } from "../../../api/endpoints/inspection-dictionary/inspection-dictionary.service";
import { compactParams } from "../../../api/params";
import type { CalculationMethod } from "../../../api/endpoints/model/calculationMethod";
import type { CalculationAlgorithmType } from "../../../api/endpoints/model/calculationAlgorithmType";

/** 行结构 = 契约 CalculationMethod（复合键寻址，无 id）。 */
type CalcRule = CalculationMethod;

interface Opt {
  code: string;
  name: string;
}

const ALGORITHMS: Array<{ value: string; label: string }> = [
  { value: "simple_avg", label: "简单平均" },
  { value: "compressive_strength", label: "抗压强度" },
  { value: "flexural_strength", label: "抗折强度" },
  { value: "steel_tensile", label: "钢材拉伸" },
  { value: "formula", label: "公式计算" },
  { value: "manual", label: "人工判定" },
];

const ALGO_LABEL: Record<string, string> = Object.fromEntries(
  ALGORITHMS.map((a) => [a.value, a.label]),
);

const EMPTY_FORM: Record<string, string> = {
  inspectionObjectCode: "",
  inspectionParameterCode: "",
  testingStandardCode: "",
  algorithmType: "manual",
  specimenCount: "1",
  roundingRule: "",
  remark: "",
};

@Component({
  selector: "app-calc-method-form-dialog",
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
    <h2 mat-dialog-title>{{ data.editing ? "编辑计算方法" : "新建计算方法" }}</h2>
    <mat-dialog-content>
      <p class="desc">复合主键：检测项目 + 检测参数（PUT/DELETE 按组合键寻址）</p>
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
        <mat-label>判定标准（可选）</mat-label>
        <mat-select name="testingStandardCode" [(ngModel)]="form['testingStandardCode']">
          <mat-option value="">不指定</mat-option>
          @for (s of data.standards; track s.code) {
            <mat-option [value]="s.code">{{ s.code }} {{ s.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <div class="grid3">
        <mat-form-field>
          <mat-label>算法类型</mat-label>
          <mat-select name="algorithmType" [(ngModel)]="form['algorithmType']">
            @for (a of ALGORITHMS; track a.value) {
              <mat-option [value]="a.value">{{ a.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>试件数量</mat-label>
          <input
            matInput
            name="specimenCount"
            type="number"
            [(ngModel)]="form['specimenCount']"
          />
        </mat-form-field>
        <mat-form-field>
          <mat-label>修约规则</mat-label>
          <input
            matInput
            name="roundingRule"
            [(ngModel)]="form['roundingRule']"
            placeholder="如 修约到 0.1"
          />
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
    `,
  ],
})
export class CalcMethodFormDialogComponent {
  readonly data: {
    editing: CalcRule | null;
    objects: Opt[];
    parameters: Opt[];
    standards: Opt[];
    saveError: string | null;
    form: Record<string, string>;
  } = inject(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<CalcMethodFormDialogComponent, boolean>>(MatDialogRef);

  readonly ALGORITHMS = ALGORITHMS;
  form = this.data.form;

  cancel(): void {
    this.ref.close(false);
  }

  save(): void {
    this.ref.close(true);
  }
}

@Component({
  selector: "app-calculation-method-list",
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
    <div class="page" data-fn="M06.F05.I01">
      @if (loading() && items().length === 0) {
        <app-page-loading />
      } @else {
        <div class="card">
          <h2>计算方法维护</h2>
          <p class="desc">
            M06.F05 计算方法（复合主键：检测项目 + 检测参数）——算法类型 + 试件数量 +
            修约规则
          </p>

          <div class="toolbar">
            <mat-form-field class="w56">
              <mat-label>搜索</mat-label>
              <input
                matInput
                aria-label="搜索"
                placeholder="搜索项目/参数"
                [value]="keyword()"
                (input)="keyword.set($any($event.target).value)"
              />
            </mat-form-field>
            <button mat-button (click)="openCreate()" data-fn="M06.F05.I01">
              <mat-icon>add</mat-icon>
              新建计算方法
            </button>
          </div>

          @if (error(); as err) {
            <div role="alert" class="alert">{{ err }}</div>
          }

          @if (filtered().length === 0) {
            <app-empty-state title="暂无计算方法" description="点击右上角新建一条" />
          } @else {
            <table>
              <thead>
                <tr>
                  <th>检测项目</th>
                  <th>检测参数</th>
                  <th>判定标准</th>
                  <th>算法类型</th>
                  <th>试件数量</th>
                  <th>备注</th>
                  <th class="w32">操作</th>
                </tr>
              </thead>
              <tbody>
                @for (
                  row of filtered();
                  track row.inspectionObjectCode + "/" + row.inspectionParameterCode
                ) {
                  <tr>
                    <td>
                      <div class="mono">{{ row.inspectionObjectCode }}</div>
                      @if (objectNameByCode().get(row.inspectionObjectCode); as objName) {
                        <div class="muted-xs">{{ objName }}</div>
                      }
                    </td>
                    <td>
                      <div class="mono">{{ row.inspectionParameterCode }}</div>
                      @if (
                        parameterNameByCode().get(row.inspectionParameterCode);
                        as paramName
                      ) {
                        <div class="muted-xs">{{ paramName }}</div>
                      }
                    </td>
                    <td class="mono">{{ row.testingStandardCode ?? "-" }}</td>
                    <td>
                      <span class="badge outline">{{
                        algoLabel(row.algorithmType)
                      }}</span>
                    </td>
                    <td>{{ row.specimenCount }}</td>
                    <td class="muted-xs">{{ row.remark ?? "-" }}</td>
                    <td class="ops">
                      <button
                        mat-button
                        (click)="openEdit(row)"
                        data-fn="M06.F05.I01"
                        [attr.aria-label]="
                          '编辑 ' +
                          row.inspectionObjectCode +
                          '/' +
                          row.inspectionParameterCode
                        "
                      >
                        编辑
                      </button>
                      <button
                        mat-button
                        class="danger"
                        (click)="askDelete(row)"
                        data-fn="M06.F05.I01"
                        [attr.aria-label]="
                          '删除 ' +
                          row.inspectionObjectCode +
                          '/' +
                          row.inspectionParameterCode
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

          <div class="muted">共 {{ filtered().length }} 条</div>
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
      .muted-xs {
        font-size: 0.75rem;
        color: #94a3b8;
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
      .w56 {
        width: 14rem;
      }
      .w32 {
        width: 8rem;
      }
    `,
  ],
})
export class CalculationMethodListComponent {
  private readonly api = inject(CalculationMethodsService);
  private readonly dict = inject(InspectionDictionaryService);
  private readonly dialog = inject(MatDialog);

  readonly items = signal<CalcRule[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly objects = signal<Opt[]>([]);
  readonly parameters = signal<Opt[]>([]);
  readonly standards = signal<Opt[]>([]);
  readonly keyword = signal("");

  readonly deleting = signal<CalcRule | null>(null);
  readonly deletingBusy = signal(false);
  readonly deleteError = signal<string | null>(null);

  /** 契约 list 无 keyword 参数——前端按 组合键/备注 模糊过滤。 */
  readonly filtered = computed(() => {
    const kw = this.keyword().trim().toLowerCase();
    if (!kw) return this.items();
    return this.items().filter(
      (row) =>
        row.inspectionObjectCode.toLowerCase().includes(kw) ||
        row.inspectionParameterCode.toLowerCase().includes(kw) ||
        (row.remark ?? "").toLowerCase().includes(kw),
    );
  });

  /** 契约实体不带 objectName/parameterName 冗余列——由字典 code 反查。 */
  readonly objectNameByCode = computed(
    () => new Map(this.objects().map((o) => [o.code, o.name])),
  );
  readonly parameterNameByCode = computed(
    () => new Map(this.parameters().map((p) => [p.code, p.name])),
  );

  constructor() {
    effect(() => {
      void this.load();
    });
    effect(() => {
      void firstValueFrom(
        this.dict.inspectionDictionaryListObjects(
          compactParams({ page: 1, pageSize: 200 }),
        ),
      )
        .then((r) => this.objects.set(r.items ?? []))
        .catch(() => undefined);
    });
    effect(() => {
      void firstValueFrom(
        this.dict.inspectionDictionaryListParameters(
          compactParams({ page: 1, pageSize: 200 }),
        ),
      )
        .then((r) => this.parameters.set(r.items ?? []))
        .catch(() => undefined);
    });
    effect(() => {
      void firstValueFrom(
        this.dict.inspectionDictionaryListStandards(
          compactParams({ page: 1, pageSize: 200 }),
        ),
      )
        .then((r) => this.standards.set(r.items ?? []))
        .catch(() => undefined);
    });
  }

  algoLabel(t: string): string {
    return ALGO_LABEL[t] ?? t;
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.api.calculationMethodsListCalculationMethods(),
      );
      this.items.set(Array.isArray(res) ? res : []);
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

  openEdit(row: CalcRule): void {
    void this.openForm(row);
  }

  private async openForm(editing: CalcRule | null): Promise<void> {
    const form: Record<string, string> = editing
      ? {
          inspectionObjectCode: editing.inspectionObjectCode,
          inspectionParameterCode: editing.inspectionParameterCode,
          testingStandardCode: editing.testingStandardCode ?? "",
          algorithmType: editing.algorithmType,
          specimenCount: String(editing.specimenCount ?? 1),
          roundingRule: editing.roundingRule ?? "",
          remark: editing.remark ?? "",
        }
      : { ...EMPTY_FORM };
    const ref = this.dialog.open(CalcMethodFormDialogComponent, {
      width: "40rem",
      data: {
        editing,
        objects: this.objects(),
        parameters: this.parameters(),
        standards: this.standards(),
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
    editing: CalcRule | null,
    form: Record<string, string>,
  ): Promise<void> {
    const payload = {
      inspectionObjectCode: form["inspectionObjectCode"] ?? "",
      inspectionParameterCode: form["inspectionParameterCode"] ?? "",
      testingStandardCode: form["testingStandardCode"] || undefined,
      algorithmType: form["algorithmType"] as CalculationAlgorithmType,
      specimenCount: Number(form["specimenCount"]) || 1,
      roundingRule: form["roundingRule"] || undefined,
      remark: form["remark"] || undefined,
    };
    try {
      if (editing) {
        await firstValueFrom(
          this.api.calculationMethodsUpdateCalculationMethod(
            editing.inspectionObjectCode,
            editing.inspectionParameterCode,
            payload,
          ),
        );
      } else {
        await firstValueFrom(this.api.calculationMethodsCreateCalculationMethod(payload));
      }
      await this.load();
    } catch (err) {
      // 保存失败把错误带回弹窗（react toast 语义等价：错误可见不吞）
      console.error("save failed:", err);
      const msg = (err as { error?: { message?: string } })?.error?.message ?? "保存失败";
      const ref = this.dialog.open(CalcMethodFormDialogComponent, {
        width: "40rem",
        data: {
          editing,
          objects: this.objects(),
          parameters: this.parameters(),
          standards: this.standards(),
          saveError: msg,
          form,
        },
      });
      const saved = (await firstValueFrom(ref.afterClosed())) as boolean | undefined;
      if (saved) await this.save(editing, form);
    }
  }

  /** 删除确认弹窗（react ConfirmModal 语义 1:1）。 */
  askDelete(row: CalcRule): void {
    this.deleting.set(row);
    this.deleteError.set(null);
    const ref = this.dialog.open(CalcMethodConfirmDialogComponent, {
      width: "26rem",
      data: {
        objectCode: row.inspectionObjectCode,
        parameterCode: row.inspectionParameterCode,
        deleteError: this.deleteError,
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
        this.api.calculationMethodsDeleteCalculationMethod(
          target.inspectionObjectCode,
          target.inspectionParameterCode,
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
  selector: "app-calc-method-confirm-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>删除计算方法</h2>
    <mat-dialog-content>
      <p>
        确定删除
        <span class="mono">{{ data.objectCode }} / {{ data.parameterCode }}</span> ？
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
export class CalcMethodConfirmDialogComponent {
  readonly data: {
    objectCode: string;
    parameterCode: string;
    deleteError: Signal<string | null>;
  } = inject(MAT_DIALOG_DATA);
  readonly ref =
    inject<MatDialogRef<CalcMethodConfirmDialogComponent, boolean>>(MatDialogRef);
}
