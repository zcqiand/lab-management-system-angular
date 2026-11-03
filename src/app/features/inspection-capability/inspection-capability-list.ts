// M06 检测能力主表 4 页（specialty / object / parameter / standard）。
// 移植自 lab-management-system-react/src/features/inspection-capability/InspectionCapabilityList.tsx
//（REQ-2026-031 L-T1，行为 1:1）。
//
// 镜像 nextjs InspectionCapabilityPage 的多资源模式（无路由参数，input `resource`
// 区分；4 个薄 wrapper 页负责传值，同 react page wrappers）。
//
// 数据说明（orval inspection-dictionary tag，code 主键）：
//   - specialties/objects 列表支持 keyword（objects 另支持 inspectionSpecialtyCode）；
//   - parameters/standards 列表契约仅支持 keyword（+sourceType/status）——
//     专项/项目/标准三维筛选在客户端用 link 端点组合（object-parameter /
//     object-standard / specialty→objects→links），语义照抄 react 版；
//   - 契约实体不带 junction 聚合列，旧展示列已移除（关联数据走 *LinkDialog）。
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
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
import { ParameterStandardLinkDialogComponent } from "./parameter-standard-link-dialog";
import { InspectionDictionaryService } from "../../../api/endpoints/inspection-dictionary/inspection-dictionary.service";
import { compactParams } from "../../../api/params";
import type { InspectionSpecialty } from "../../../api/endpoints/model/inspectionSpecialty";
import type { InspectionObject } from "../../../api/endpoints/model/inspectionObject";
import type { InspectionParameter } from "../../../api/endpoints/model/inspectionParameter";
import type { InspectionStandard } from "../../../api/endpoints/model/inspectionStandard";
import type { InspectionParameterSourceType } from "../../../api/endpoints/model/inspectionParameterSourceType";
import type { InspectionStandardStatus } from "../../../api/endpoints/model/inspectionStandardStatus";

export type CapabilityResource = "specialties" | "objects" | "parameters" | "standards";

/** 列表行视图：4 个字典实体的公共展示面（code 主键，无 id 列）。 */
export interface ListItem {
  code: string;
  name: string;
  officialNo?: string;
  sortOrder?: number;
  enabled?: boolean;
  isOfficial?: boolean;
  sourceType?: string;
  status?: string;
  unit?: string;
  version?: string;
}

const TITLES: Record<CapabilityResource, string> = {
  specialties: "检测专项维护",
  objects: "检测项目维护",
  parameters: "检测参数维护",
  standards: "检测标准维护",
};

const HINTS: Record<CapabilityResource, string> = {
  specialties: "InspectionSpecialty 实体码表维护，机构检测能力字典根",
  objects: "InspectionObject 实体码表维护，按检测专项过滤；支持项目↔专项/参数关联",
  parameters: "InspectionParameter 实体码表维护，列表按专项/项目/标准过滤",
  standards: "InspectionStandard 实体码表维护（含状态：active/superseded/draft）",
};

const CREATE_LABELS: Record<CapabilityResource, string> = {
  specialties: "新建检测专项",
  objects: "新建检测项目",
  parameters: "新建检测参数",
  standards: "新建检测标准",
};

const FN_ID: Record<CapabilityResource, string> = {
  specialties: "M06.F01.I01",
  objects: "M06.F02.I01",
  parameters: "M06.F03.I01",
  standards: "M06.F04.I01",
};

const FN_CREATE: Record<CapabilityResource, string> = {
  specialties: "M06.F01.I01",
  objects: "M06.F02.I02",
  parameters: "M06.F03.I01",
  standards: "M06.F04.I02",
};

const FN_DELETE: Record<CapabilityResource, string> = {
  specialties: "M06.F01.I01",
  objects: "M06.F02.I01",
  parameters: "M06.F03.I01",
  standards: "M06.F04.I01",
};

// @entry M06.F01.I01
// @entry M06.F02.I01
// @entry M06.F03.I01
// @entry M06.F04.I01
// @entry M06.F02.I02
// @entry M06.F04.I02
// M06.F02.I02 项目↔专项/参数关联（行内 / 新建表单下拉选检测专项编码）
// M06.F04.I02 标准 CRUD（行内 编辑/删除 按钮）
// M06.F03.I02 参数↔标准关联（parameters 行内「关联标准」→ ParameterStandardLinkDialog）

export const STANDARD_STATUS_CN: Record<string, string> = {
  active: "现行",
  superseded: "被替代",
  draft: "草案",
};

const PAGE_SIZE = 50;

@Component({
  selector: "app-capability-form-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.editing ? "编辑" : "" }}{{ TITLES[data.resource] }}</h2>
    <mat-dialog-content>
      @if (data.saveError) {
        <div role="alert" class="save-error">{{ data.saveError }}</div>
      }
      <div class="grid2">
        <mat-form-field>
          <mat-label>编码</mat-label>
          <input
            matInput
            name="code"
            [(ngModel)]="form['code']"
            [disabled]="!!data.editing"
          />
        </mat-form-field>
        <mat-form-field>
          <mat-label>名称</mat-label>
          <input matInput name="name" [(ngModel)]="form['name']" />
        </mat-form-field>
      </div>
      @if (data.resource === "specialties") {
        <div class="grid3">
          <mat-form-field>
            <mat-label>官方序号</mat-label>
            <input matInput name="officialNo" [(ngModel)]="form['officialNo']" />
          </mat-form-field>
          <mat-checkbox name="isOfficial" [(ngModel)]="form['isOfficial']"
            >官方</mat-checkbox
          >
          <mat-checkbox name="enabled" [(ngModel)]="form['enabled']">启用</mat-checkbox>
        </div>
      }
      @if (data.resource === "objects") {
        <mat-form-field>
          <mat-label>检测专项编码</mat-label>
          <mat-select
            name="inspectionSpecialtyCode"
            [(ngModel)]="form['inspectionSpecialtyCode']"
          >
            <mat-option value="">未选择</mat-option>
            @for (s of data.specialtyOptions; track s.code) {
              <mat-option [value]="s.code">{{ s.code }} {{ s.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <div class="grid2">
          <mat-form-field>
            <mat-label>来源行号</mat-label>
            <input
              matInput
              name="sourceProjectNo"
              [(ngModel)]="form['sourceProjectNo']"
            />
          </mat-form-field>
          <mat-form-field>
            <mat-label>来源行名称</mat-label>
            <input
              matInput
              name="sourceProjectName"
              [(ngModel)]="form['sourceProjectName']"
            />
          </mat-form-field>
        </div>
        <div class="grid3">
          <mat-checkbox name="isOfficial" [(ngModel)]="form['isOfficial']"
            >官方</mat-checkbox
          >
          <mat-checkbox name="enabled" [(ngModel)]="form['enabled']">启用</mat-checkbox>
          <mat-checkbox
            name="isOptionalForQualification"
            [(ngModel)]="form['isOptionalForQualification']"
            >资质可选</mat-checkbox
          >
        </div>
        <div class="hint">
          M06.F02.I02 项目↔专项/参数关联：选择检测专项编码，把项目挂到专项下
        </div>
      }
      @if (data.resource === "parameters") {
        <div class="grid3">
          <mat-form-field>
            <mat-label>单位</mat-label>
            <input matInput name="unit" [(ngModel)]="form['unit']" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>来源类型</mat-label>
            <mat-select name="sourceType" [(ngModel)]="form['sourceType']">
              <mat-option value="official">官方</mat-option>
              <mat-option value="custom">自定义</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      }
      @if (data.resource === "standards") {
        <div class="grid3">
          <mat-form-field>
            <mat-label>版本</mat-label>
            <input matInput name="version" [(ngModel)]="form['version']" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>状态</mat-label>
            <mat-select name="status" [(ngModel)]="form['status']">
              <mat-option value="active">现行</mat-option>
              <mat-option value="superseded">被替代</mat-option>
              <mat-option value="draft">草案</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>来源文件</mat-label>
            <input
              matInput
              name="sourceDocumentId"
              [(ngModel)]="form['sourceDocumentId']"
            />
          </mat-form-field>
        </div>
      }
      <mat-form-field>
        <mat-label>排序</mat-label>
        <input matInput name="sortOrder" type="number" [(ngModel)]="form['sortOrder']" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">取消</button>
      <button mat-button (click)="save()">保存</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .grid2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
      }
      .grid3 {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
        align-items: center;
      }
      .save-error {
        color: #dc2626;
        background: #fef2f2;
        padding: 0.5rem;
        border-radius: 0.25rem;
        margin-bottom: 0.75rem;
        font-size: 0.875rem;
      }
      .hint {
        font-size: 0.75rem;
        color: #64748b;
        margin: 0.5rem 0;
      }
      mat-form-field {
        width: 100%;
      }
    `,
  ],
})
export class CapabilityFormDialogComponent {
  readonly data: {
    resource: CapabilityResource;
    editing: ListItem | null;
    specialtyOptions: InspectionSpecialty[];
    saveError: string | null;
    form: Record<string, string | boolean | number>;
  } = inject(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<CapabilityFormDialogComponent, boolean>>(MatDialogRef);

  readonly TITLES = TITLES;
  form = this.data.form;

  cancel(): void {
    this.ref.close(false);
  }

  save(): void {
    this.ref.close(true);
  }
}

@Component({
  selector: "app-inspection-capability-list",
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
  templateUrl: "./inspection-capability-list.html",
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
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        padding: 1.25rem;
      }
      .card h2 {
        margin: 0;
        font-size: 1.125rem;
      }
      .card .desc {
        margin: 0.25rem 0 1rem;
        font-size: 0.875rem;
        color: #64748b;
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
      }
      th,
      td {
        border-bottom: 1px solid #e2e8f0;
        padding: 0.5rem 0.75rem;
        text-align: left;
      }
      .badge {
        display: inline-block;
        padding: 0.1rem 0.5rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        background: #dbeafe;
        color: #1d4ed8;
      }
      .badge.outline {
        background: transparent;
        border: 1px solid #cbd5e1;
        color: #475569;
      }
      .danger {
        color: #dc2626;
      }
      .muted {
        color: #64748b;
        font-size: 0.875rem;
        display: flex;
        justify-content: space-between;
      }
      .alert {
        color: #dc2626;
        background: #fef2f2;
        padding: 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.875rem;
      }
      .w56 {
        width: 14rem;
      }
      .w40 {
        width: 10rem;
      }
    `,
  ],
})
export class InspectionCapabilityListComponent {
  readonly resource = input.required<CapabilityResource>();

  private readonly api = inject(InspectionDictionaryService);
  private readonly dialog = inject(MatDialog);

  readonly items = signal<ListItem[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly keyword = signal("");
  readonly specialtyFilter = signal("");
  readonly objectFilter = signal("");
  readonly standardFilter = signal("");
  readonly specialtyOptions = signal<InspectionSpecialty[]>([]);
  readonly objectOptions = signal<InspectionObject[]>([]);
  readonly standardOptions = signal<InspectionStandard[]>([]);
  readonly parameterOptions = signal<InspectionParameter[]>([]);

  readonly deleting = signal<ListItem | null>(null);
  readonly deletingBusy = signal(false);
  readonly deleteError = signal<string | null>(null);

  readonly title = computed(() => TITLES[this.resource()]);
  readonly hint = computed(() => HINTS[this.resource()]);
  readonly createLabel = computed(() => CREATE_LABELS[this.resource()]);
  readonly fnId = computed(() => FN_ID[this.resource()]);
  readonly fnCreate = computed(() => FN_CREATE[this.resource()]);
  readonly fnDelete = computed(() => FN_DELETE[this.resource()]);
  readonly columnHeaders = computed<string[]>(() => {
    const r = this.resource();
    if (r === "specialties") return ["编码", "名称", "官方序号", "官方/自定义", "状态"];
    if (r === "objects") return ["编码", "名称", "状态"];
    if (r === "parameters") return ["编码", "名称", "单位", "来源"];
    return ["编码", "名称", "版本", "状态"];
  });

  constructor() {
    // react useEffect(load, [resource, keyword, *filters]) 等价：任一变化重拉
    effect(() => {
      this.resource();
      this.keyword();
      this.specialtyFilter();
      this.objectFilter();
      this.standardFilter();
      void this.load();
    });
    // 专项下拉选项（objects/standards/parameters 视图）
    effect(() => {
      const r = this.resource();
      if (r === "specialties") {
        this.specialtyOptions.set([]);
        return;
      }
      void firstValueFrom(
        this.api.inspectionDictionaryListSpecialties(
          compactParams({ page: 1, pageSize: 100 }),
        ),
      )
        .then((res) => this.specialtyOptions.set(res.items ?? []))
        .catch(() => undefined);
    });
    // 项目下拉选项（standards/parameters，按专项过滤）
    effect(() => {
      const r = this.resource();
      const sf = this.specialtyFilter();
      if (r !== "standards" && r !== "parameters") {
        this.objectOptions.set([]);
        return;
      }
      void firstValueFrom(
        this.api.inspectionDictionaryListObjects(
          compactParams({
            page: 1,
            pageSize: 200,
            inspectionSpecialtyCode: sf || undefined,
          }),
        ),
      )
        .then((res) => this.objectOptions.set(res.items ?? []))
        .catch(() => undefined);
    });
    // 标准下拉选项（parameters 视图）
    effect(() => {
      const r = this.resource();
      if (r !== "parameters") {
        this.standardOptions.set([]);
        return;
      }
      void firstValueFrom(
        this.api.inspectionDictionaryListStandards(
          compactParams({ page: 1, pageSize: 200 }),
        ),
      )
        .then((res) => this.standardOptions.set(res.items ?? []))
        .catch(() => undefined);
    });
    // 参数下拉（objects 新建/编辑用）
    effect(() => {
      const r = this.resource();
      if (r !== "objects") {
        this.parameterOptions.set([]);
        return;
      }
      void firstValueFrom(
        this.api.inspectionDictionaryListParameters(
          compactParams({ page: 1, pageSize: 200 }),
        ),
      )
        .then((res) => this.parameterOptions.set(res.items ?? []))
        .catch(() => undefined);
    });
  }

  /** 实体 → 行视图归一（契约实体字段比视图宽，裁 createdAt/updatedAt 等）。 */
  private toRow(
    e: InspectionSpecialty | InspectionObject | InspectionParameter | InspectionStandard,
  ): ListItem {
    return { ...e };
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const r = this.resource();
    const kw = this.keyword().trim() || undefined;
    try {
      if (r === "specialties") {
        const res = await firstValueFrom(
          this.api.inspectionDictionaryListSpecialties(
            compactParams({
              page: 1,
              pageSize: PAGE_SIZE,
              keyword: kw,
            }),
          ),
        );
        this.items.set((res.items ?? []).map((e) => this.toRow(e)));
        this.total.set(res.total ?? 0);
      } else if (r === "objects") {
        const res = await firstValueFrom(
          this.api.inspectionDictionaryListObjects(
            compactParams({
              page: 1,
              pageSize: PAGE_SIZE,
              keyword: kw,
              inspectionSpecialtyCode: this.specialtyFilter() || undefined,
            }),
          ),
        );
        this.items.set((res.items ?? []).map((e) => this.toRow(e)));
        this.total.set(res.total ?? 0);
      } else if (r === "parameters") {
        // 契约 list 仅支持 keyword/sourceType——专项/项目/标准三维筛选用
        // link 端点在客户端组合（交集）。
        const res = await firstValueFrom(
          this.api.inspectionDictionaryListParameters(
            compactParams({
              page: 1,
              pageSize: 500,
              keyword: kw,
            }),
          ),
        );
        let rows = (res.items ?? []).map((e) => this.toRow(e));
        const sf = this.specialtyFilter();
        const of = this.objectFilter();
        const stf = this.standardFilter();
        if (sf) {
          const objRes = await firstValueFrom(
            this.api.inspectionDictionaryListObjects(
              compactParams({
                page: 1,
                pageSize: 500,
                inspectionSpecialtyCode: sf,
              }),
            ),
          );
          const objectCodes = new Set((objRes.items ?? []).map((o) => o.code));
          const linkRes = await firstValueFrom(
            this.api.inspectionDictionaryListObjectParameterLinks(compactParams({})),
          );
          const paramCodes = new Set(
            (linkRes.items ?? [])
              .filter((l) => objectCodes.has(l.inspectionObjectCode))
              .map((l) => l.inspectionParameterCode),
          );
          rows = rows.filter((row) => paramCodes.has(row.code));
        }
        if (of) {
          const linkRes = await firstValueFrom(
            this.api.inspectionDictionaryListObjectParameterLinks(
              compactParams({
                inspectionObjectCode: of,
              }),
            ),
          );
          const paramCodes = new Set(
            (linkRes.items ?? []).map((l) => l.inspectionParameterCode),
          );
          rows = rows.filter((row) => paramCodes.has(row.code));
        }
        if (stf) {
          const linkRes = await firstValueFrom(
            this.api.inspectionDictionaryListStandardParameterLinks(
              compactParams({
                inspectionStandardCode: stf,
              }),
            ),
          );
          const paramCodes = new Set(
            (linkRes.items ?? []).map((l) => l.inspectionParameterCode),
          );
          rows = rows.filter((row) => paramCodes.has(row.code));
        }
        this.items.set(rows);
        this.total.set(rows.length);
      } else {
        // standards：契约 list 仅支持 keyword/status——专项/项目筛选用
        // specialty→objects→object-standard links 客户端组合。
        const res = await firstValueFrom(
          this.api.inspectionDictionaryListStandards(
            compactParams({
              page: 1,
              pageSize: PAGE_SIZE,
              keyword: kw,
            }),
          ),
        );
        let rows = (res.items ?? []).map((e) => this.toRow(e));
        let stdCodes: Set<string> | null = null;
        const sf = this.specialtyFilter();
        const of = this.objectFilter();
        if (sf) {
          const objRes = await firstValueFrom(
            this.api.inspectionDictionaryListObjects(
              compactParams({
                page: 1,
                pageSize: 500,
                inspectionSpecialtyCode: sf,
              }),
            ),
          );
          const objectCodes = new Set((objRes.items ?? []).map((o) => o.code));
          const linkRes = await firstValueFrom(
            this.api.inspectionDictionaryListObjectStandardLinks(compactParams({})),
          );
          stdCodes = new Set(
            (linkRes.items ?? [])
              .filter((l) => objectCodes.has(l.inspectionObjectCode))
              .map((l) => l.inspectionStandardCode),
          );
        }
        if (of) {
          const linkRes = await firstValueFrom(
            this.api.inspectionDictionaryListObjectStandardLinks(
              compactParams({
                inspectionObjectCode: of,
              }),
            ),
          );
          const byObject = new Set(
            (linkRes.items ?? []).map((l) => l.inspectionStandardCode),
          );
          stdCodes = stdCodes
            ? new Set([...stdCodes].filter((c) => byObject.has(c)))
            : byObject;
        }
        if (stdCodes) rows = rows.filter((row) => stdCodes.has(row.code));
        this.items.set(rows);
        this.total.set(rows.length);
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : "加载失败");
      this.items.set([]);
      this.total.set(0);
    } finally {
      this.loading.set(false);
    }
  }

  isOfficialRow(item: ListItem): boolean {
    const r = this.resource();
    if (r === "specialties" || r === "objects") return item.isOfficial === true;
    if (r === "parameters") return item.sourceType === "official";
    return false;
  }

  statusCn(status: string | undefined): string {
    return STANDARD_STATUS_CN[status ?? ""] ?? status ?? "-";
  }

  onSpecialtyFilter(v: string): void {
    this.specialtyFilter.set(v);
    this.objectFilter.set("");
    this.standardFilter.set("");
  }

  onObjectFilter(v: string): void {
    this.objectFilter.set(v);
    this.standardFilter.set("");
  }

  openCreate(): void {
    void this.openForm(null);
  }

  openEdit(item: ListItem): void {
    void this.openForm(item);
  }

  /** 行内「关联标准」→ ParameterStandardLinkDialog（仅 parameters 视图）。
   *  关闭后刷新列表（关联数据变化不影响本页列，但 react 版语义是重拉）。 */
  openLinkDialog(item: ListItem): void {
    const ref = this.dialog.open(ParameterStandardLinkDialogComponent, {
      width: "42rem",
      data: {
        parameterCode: item.code,
        parameterName: item.name,
        onChanged: () => {
          void this.load();
        },
      },
    });
    void firstValueFrom(ref.afterClosed()).then(() => {
      void this.load();
    });
  }

  /** 删除确认弹窗（react ConfirmModal 语义 1:1：官方数据与被引用数据不可删）。 */
  askDelete(item: ListItem): void {
    const ref = this.dialog.open(CapabilityConfirmDialogComponent, {
      width: "24rem",
      data: {
        title: `删除${TITLES[this.resource()]}`,
        message: `确定删除 ${item.code}？官方数据与被引用数据不可删除。`,
      },
    });
    void firstValueFrom(ref.afterClosed()).then((ok) => {
      if (ok) {
        this.deleting.set(item);
        void this.confirmDelete();
      }
    });
  }

  private resetForm(): Record<string, string | boolean | number> {
    const r = this.resource();
    if (r === "specialties") {
      return {
        code: "",
        name: "",
        officialNo: "",
        isOfficial: false,
        enabled: true,
        sortOrder: "999",
      };
    }
    if (r === "objects") {
      return {
        code: "",
        name: "",
        inspectionSpecialtyCode: "",
        sourceProjectNo: "",
        sourceProjectName: "",
        isOptionalForQualification: false,
        isOfficial: false,
        enabled: true,
        sortOrder: "999",
      };
    }
    if (r === "parameters") {
      return { code: "", name: "", unit: "", sourceType: "custom", sortOrder: "999" };
    }
    return {
      code: "",
      name: "",
      version: "",
      status: "active",
      sourceDocumentId: "",
      sortOrder: "999",
    };
  }

  private async openForm(editing: ListItem | null): Promise<void> {
    const form = this.resetForm();
    if (editing) {
      for (const [k, v] of Object.entries(editing)) {
        if (typeof v === "boolean" || typeof v === "string" || typeof v === "number") {
          form[k] = v;
        }
      }
      form["sortOrder"] = Number(editing.sortOrder ?? 999);
    }
    const ref = this.dialog.open(CapabilityFormDialogComponent, {
      width: "36rem",
      data: {
        resource: this.resource(),
        editing,
        specialtyOptions: this.specialtyOptions(),
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
    editing: ListItem | null,
    form: Record<string, string | boolean | number>,
  ): Promise<void> {
    const r = this.resource();
    try {
      if (editing) {
        if (r === "specialties") {
          await firstValueFrom(
            this.api.inspectionDictionaryUpdateSpecialty(editing.code, {
              officialNo: (form["officialNo"] as string) || undefined,
              name: (form["name"] as string) || undefined,
              isOfficial: form["isOfficial"] === true,
              enabled: form["enabled"] === true,
              sortOrder: Number(form["sortOrder"]) || 999,
            }),
          );
        } else if (r === "objects") {
          await firstValueFrom(
            this.api.inspectionDictionaryUpdateObject(editing.code, {
              inspectionSpecialtyCode:
                (form["inspectionSpecialtyCode"] as string) || undefined,
              sourceProjectNo: (form["sourceProjectNo"] as string) || undefined,
              sourceProjectName: (form["sourceProjectName"] as string) || undefined,
              name: (form["name"] as string) || undefined,
              isOptionalForQualification: form["isOptionalForQualification"] === true,
              isOfficial: form["isOfficial"] === true,
              enabled: form["enabled"] === true,
              sortOrder: Number(form["sortOrder"]) || 999,
            }),
          );
        } else if (r === "parameters") {
          await firstValueFrom(
            this.api.inspectionDictionaryUpdateParameter(editing.code, {
              name: (form["name"] as string) || undefined,
              unit: (form["unit"] as string) || undefined,
              sourceType: ((form["sourceType"] as string) ||
                "custom") as InspectionParameterSourceType,
              sortOrder: Number(form["sortOrder"]) || 999,
            }),
          );
        } else {
          await firstValueFrom(
            this.api.inspectionDictionaryUpdateStandard(editing.code, {
              name: (form["name"] as string) || undefined,
              version: (form["version"] as string) || undefined,
              status: ((form["status"] as string) ||
                "active") as InspectionStandardStatus,
              sourceDocumentId: (form["sourceDocumentId"] as string) || undefined,
              sortOrder: Number(form["sortOrder"]) || 999,
            }),
          );
        }
      } else {
        if (r === "specialties") {
          await firstValueFrom(
            this.api.inspectionDictionaryCreateSpecialty({
              code: (form["code"] as string) ?? "",
              officialNo: (form["officialNo"] as string) || "",
              name: (form["name"] as string) ?? "",
              isOfficial: form["isOfficial"] === true,
              enabled: form["enabled"] === true,
              sortOrder: Number(form["sortOrder"]) || 999,
            }),
          );
        } else if (r === "objects") {
          await firstValueFrom(
            this.api.inspectionDictionaryCreateObject({
              code: (form["code"] as string) ?? "",
              inspectionSpecialtyCode: (form["inspectionSpecialtyCode"] as string) || "",
              sourceProjectNo: (form["sourceProjectNo"] as string) || "",
              sourceProjectName: (form["sourceProjectName"] as string) || "",
              name: (form["name"] as string) ?? "",
              isOptionalForQualification: form["isOptionalForQualification"] === true,
              isOfficial: form["isOfficial"] === true,
              enabled: form["enabled"] === true,
              sortOrder: Number(form["sortOrder"]) || 999,
            }),
          );
        } else if (r === "parameters") {
          await firstValueFrom(
            this.api.inspectionDictionaryCreateParameter({
              code: (form["code"] as string) ?? "",
              name: (form["name"] as string) ?? "",
              rawName: (form["name"] as string) ?? "",
              canonicalName: (form["name"] as string) ?? "",
              unit: (form["unit"] as string) || undefined,
              sourceType: ((form["sourceType"] as string) ||
                "custom") as InspectionParameterSourceType,
              sortOrder: Number(form["sortOrder"]) || 999,
            }),
          );
        } else {
          await firstValueFrom(
            this.api.inspectionDictionaryCreateStandard({
              code: (form["code"] as string) ?? "",
              name: (form["name"] as string) ?? "",
              version: (form["version"] as string) || undefined,
              status: ((form["status"] as string) ||
                "active") as InspectionStandardStatus,
              sourceDocumentId: (form["sourceDocumentId"] as string) || undefined,
              sortOrder: Number(form["sortOrder"]) || 999,
            }),
          );
        }
      }
      await this.load();
    } catch (err) {
      // 保存失败把错误带回弹窗（保存态由 dialog 内 saveError 呈现）——
      // 这里重新打开弹窗带错误。react 版 toast 语义等价：错误可见不吞。
      console.error("save failed:", err);
      const msg = (err as { message?: string })?.message ?? "保存失败";
      const ref = this.dialog.open(CapabilityFormDialogComponent, {
        width: "36rem",
        data: {
          resource: r,
          editing,
          specialtyOptions: this.specialtyOptions(),
          saveError: msg,
          form,
        },
      });
      const saved = (await firstValueFrom(ref.afterClosed())) as boolean | undefined;
      if (saved) await this.save(editing, form);
    }
  }

  async confirmDelete(): Promise<void> {
    const target = this.deleting();
    if (!target) return;
    this.deletingBusy.set(true);
    this.deleteError.set(null);
    const r = this.resource();
    try {
      if (r === "specialties") {
        await firstValueFrom(this.api.inspectionDictionaryDeleteSpecialty(target.code));
      } else if (r === "objects") {
        await firstValueFrom(this.api.inspectionDictionaryDeleteObject(target.code));
      } else if (r === "parameters") {
        await firstValueFrom(this.api.inspectionDictionaryDeleteParameter(target.code));
      } else {
        await firstValueFrom(this.api.inspectionDictionaryDeleteStandard(target.code));
      }
      this.deleting.set(null);
      await this.load();
    } catch (err) {
      this.deleteError.set((err as { message?: string })?.message ?? "删除失败");
    } finally {
      this.deletingBusy.set(false);
    }
  }
}

/** 删除确认小弹窗（react ConfirmModal 等价：确认 true / 取消 undefined）。 */
@Component({
  selector: "app-capability-confirm-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()">取消</button>
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
export class CapabilityConfirmDialogComponent {
  readonly data: { title: string; message: string } = inject(MAT_DIALOG_DATA);
  readonly ref =
    inject<MatDialogRef<CapabilityConfirmDialogComponent, boolean>>(MatDialogRef);
}
