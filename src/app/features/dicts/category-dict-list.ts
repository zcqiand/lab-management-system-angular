// M04.F06-F09 型号/规格/等级/牌号 4 码表通用页 — 移植自
// lab-management-system-react/src/features/dicts/CategoryDictList.tsx
//（REQ-2026-031 L-T2，行为 1:1；dnd-kit → @angular/cdk/drag-drop，
// ConfirmModal → MatDialog，toast → error 条/弹窗内错误）。
//
// 形状：左侧检测项目树（一级）+ 右侧可拖拽排序的列表。
// 拖拽行后并行 PUT 持久化 sortOrder（code 寻址）；新建项 sortOrder 后端续号。
// orval catalog tag（code 主键：PUT/DELETE /api/catalog/{resource}/{code}）。
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from "@angular/cdk/drag-drop";
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
import { firstValueFrom, Observable } from "rxjs";

import { PageLoadingComponent } from "../../ui/page-loading.component";
import { InspectionCatalogService } from "../../../api/endpoints/inspection-catalog/inspection-catalog.service";
import { InspectionDictionaryService } from "../../../api/endpoints/inspection-dictionary/inspection-dictionary.service";
import { compactParams } from "../../../api/params";
import type { InspectionBrand } from "../../../api/endpoints/model/inspectionBrand";
import type { InspectionGrade } from "../../../api/endpoints/model/inspectionGrade";
import type { InspectionModel } from "../../../api/endpoints/model/inspectionModel";
import type { InspectionObject } from "../../../api/endpoints/model/inspectionObject";
import type { InspectionSpec } from "../../../api/endpoints/model/inspectionSpec";
import type { CreateCatalogEntryRequest } from "../../../api/endpoints/model/createCatalogEntryRequest";
import type { UpdateCatalogEntryRequest } from "../../../api/endpoints/model/updateCatalogEntryRequest";

/** 型号/规格/等级/牌号 通用行结构（4 个 InspectionModel/Spec/Grade/Brand 同构，code 为主键）。 */
type CatalogRow = InspectionModel | InspectionSpec | InspectionGrade | InspectionBrand;

/** 码表资源端点（与页路由一一对应；data-testid `${endpoint}-list` 依赖这些字面量）。 */
export type CatalogEndpoint = "/models" | "/specifications" | "/grades" | "/brands";

interface CatalogResource {
  list(params: {
    page?: number;
    pageSize?: number;
    inspectionObjectCode?: string;
  }): Observable<{ items?: CatalogRow[] }>;
  create(req: CreateCatalogEntryRequest): Promise<unknown>;
  update(code: string, req: UpdateCatalogEntryRequest): Promise<unknown>;
  remove(code: string): Promise<unknown>;
}

type CatalogKind = "models" | "specs" | "grades" | "brands";

/** inject() 只能在注入上下文里调——资源表按 kind 延迟绑定服务实例。 */
function makeCatalogResource(
  svc: InspectionCatalogService,
  kind: CatalogKind,
): CatalogResource {
  // orval 服务方法名按 kind 后缀规整（catalogListModels/Specs/Grades/Brands…），
  // 动态取名需宽化索引——cast 收敛在这一处，调用点保持强类型。
  const anySvc = svc as unknown as Record<
    string,
    (...args: unknown[]) => Observable<unknown>
  >;
  const list = (p: { page?: number; pageSize?: number; inspectionObjectCode?: string }) =>
    anySvc[`catalogList${cap(kind)}`](compactParams(p)) as Observable<{
      items?: CatalogRow[];
    }>;
  return {
    list,
    create: (r) =>
      firstValueFrom(anySvc[`catalogCreate${cap(kind)}`](r) as Observable<unknown>),
    update: (c, r) =>
      firstValueFrom(anySvc[`catalogUpdate${cap(kind)}`](c, r) as Observable<unknown>),
    remove: (c) =>
      firstValueFrom(anySvc[`catalogDelete${cap(kind)}`](c) as Observable<unknown>),
  };
}

const cap = (k: CatalogKind): string =>
  ({ models: "Models", specs: "Specs", grades: "Grades", brands: "Brands" })[k];

const CATALOG_KIND: Record<CatalogEndpoint, CatalogKind> = {
  "/models": "models",
  "/specifications": "specs",
  "/grades": "grades",
  "/brands": "brands",
};

// @entry M04.F06.I01
// @entry M04.F07.I01
// @entry M04.F08.I01
// @entry M04.F09.I01
@Component({
  selector: "app-category-dict-list",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatDialogModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    PageLoadingComponent,
  ],
  template: `
    <div class="page" [attr.data-fn]="dataFn()">
      @if ((loading() || !objectsReady()) && items().length === 0) {
        <app-page-loading />
      } @else {
        <div class="header">
          <div>
            <h1>{{ title() }}</h1>
            @if (hint(); as h) {
              <p class="desc">{{ h }}</p>
            }
          </div>
          <button
            mat-button
            (click)="openCreate()"
            [disabled]="!selectedCode() && objects().length === 0"
            [attr.data-fn]="createDataFn()"
          >
            新建
          </button>
        </div>

        @if (error(); as err) {
          <div role="alert" class="error-bar">{{ err }}</div>
        }

        <div class="grid">
          <!-- 左侧：检测项目树 -->
          <aside class="tree">
            <div class="tree-head">检测项目</div>
            <ul>
              @if (objects().length === 0) {
                <li class="tree-empty">暂无检测项目</li>
              }
              @for (o of objects(); track o.code) {
                <li>
                  <button
                    type="button"
                    (click)="selectObject(o.code)"
                    [class.is-active]="o.code === selectedCode()"
                  >
                    <span class="arrow">▸</span>
                    <span class="truncate">{{ o.name }}</span>
                  </button>
                </li>
              }
            </ul>
          </aside>

          <!-- 右侧：可拖拽列表 -->
          <section class="list-card">
            <div class="list-head">
              <span>
                @if (selectedObject(); as so) {
                  <span class="arrow">▸</span> {{ so.name }}
                } @else {
                  请选择左侧检测项目
                }
              </span>
              @if (items().length > 1) {
                <span class="muted-xs">拖拽行调整顺序</span>
              }
            </div>

            @if (loading() && items().length === 0) {
              <div class="empty">加载中...</div>
            }
            @if (!loading() && items().length === 0) {
              <div class="empty">
                {{ selectedCode() ? "暂无数据" : "请先选择左侧检测项目" }}
              </div>
            }

            @if (items().length > 0) {
              <ul
                cdkDropList
                (cdkDropListDropped)="drop($event)"
                [attr.data-testid]="endpoint() + '-list'"
              >
                @for (item of items(); track item.code) {
                  <li cdkDrag [attr.data-testid]="'row-' + item.code">
                    <button
                      type="button"
                      class="drag-handle"
                      aria-label="拖拽手柄"
                      [attr.data-testid]="'drag-handle-' + item.code"
                      cdkDragHandle
                    >
                      ⋮⋮
                    </button>
                    <span class="sort" [attr.data-testid]="'sort-' + item.code">{{
                      item.sortOrder
                    }}</span>
                    <span class="truncate name">{{ item.name }}</span>
                    <span class="truncate remark">{{ item.remark ?? "" }}</span>
                    <span class="ops">
                      <button
                        mat-button
                        (click)="openEdit(item)"
                        [attr.data-fn]="editDataFn()"
                      >
                        编辑
                      </button>
                      <button
                        mat-button
                        class="danger"
                        (click)="askDelete(item)"
                        [attr.data-fn]="deleteDataFn()"
                      >
                        删除
                      </button>
                    </span>
                  </li>
                }
              </ul>
            }
          </section>
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
        font-size: 0.75rem;
        color: #64748b;
        margin: 0.25rem 0 0;
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .error-bar {
        color: #dc2626;
        background: #fef2f2;
        padding: 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.875rem;
      }
      .grid {
        display: grid;
        grid-template-columns: 240px 1fr;
        gap: 1rem;
        flex: 1;
        min-height: 0;
      }
      aside.tree,
      .list-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .tree-head,
      .list-head {
        padding: 0.5rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 600;
        color: #64748b;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      aside ul,
      section ul {
        list-style: none;
        margin: 0;
        padding: 0;
        overflow-y: auto;
        flex: 1;
        min-height: 0;
      }
      aside button {
        width: 100%;
        text-align: left;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        background: none;
        border: none;
        border-left: 2px solid transparent;
        cursor: pointer;
      }
      aside button.is-active {
        background: #eff6ff;
        color: #1d4ed8;
        font-weight: 500;
        border-left-color: #2563eb;
      }
      .arrow {
        color: #9ca3af;
      }
      .tree-empty {
        padding: 1rem 0.75rem;
        font-size: 0.875rem;
        color: #9ca3af;
        text-align: center;
      }
      section li {
        display: flex;
        align-items: center;
        border-top: 1px solid #e2e8f0;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        background: #fff;
      }
      section li:first-child {
        border-top: none;
      }
      .drag-handle {
        background: none;
        border: none;
        color: #9ca3af;
        cursor: grab;
        margin-right: 0.5rem;
        user-select: none;
        touch-action: none;
      }
      .sort {
        width: 3rem;
        text-align: center;
        font-size: 0.75rem;
        color: #64748b;
      }
      .name {
        flex: 1;
      }
      .remark {
        flex: 1;
        color: #64748b;
        font-size: 0.75rem;
      }
      .ops {
        white-space: nowrap;
      }
      button.danger {
        color: #dc2626;
      }
      .empty {
        padding: 2rem 1rem;
        text-align: center;
        font-size: 0.875rem;
        color: #9ca3af;
      }
      .muted-xs {
        font-size: 0.75rem;
        color: #94a3b8;
        font-weight: 400;
      }
      .truncate {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ],
})
export class CategoryDictListComponent {
  /** 码表资源端点：/models /specifications /grades /brands */
  readonly endpoint = input.required<CatalogEndpoint>();
  readonly title = input.required<string>();
  readonly hint = input<string | undefined>(undefined);
  /** 功能 ID（data-fn 入口标记），格式 Mxx.Fyy.Izz */
  readonly dataFn = input<string | undefined>(undefined);
  readonly createDataFn = input<string | undefined>(undefined);
  readonly editDataFn = input<string | undefined>(undefined);
  readonly deleteDataFn = input<string | undefined>(undefined);

  private readonly catalogSvc = inject(InspectionCatalogService);
  private readonly dictionary = inject(InspectionDictionaryService);
  private readonly dialog = inject(MatDialog);

  readonly objects = signal<InspectionObject[]>([]);
  // B6 加载态：检测项目树未就绪也视为整页加载中（树与列表都到齐才出界面）
  readonly objectsReady = signal(false);
  readonly selectedCode = signal<string | null>(null);
  readonly selectedObject = computed(
    () => this.objects().find((o) => o.code === this.selectedCode()) ?? null,
  );
  readonly items = signal<CatalogRow[]>([]);
  // B6 加载态：首屏即视为加载中（首帧不渲染空表壳）
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    void this.loadObjects();
  }

  private resource(): CatalogResource {
    return makeCatalogResource(this.catalogSvc, CATALOG_KIND[this.endpoint()]);
  }

  private async loadObjects(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.dictionary.inspectionDictionaryListObjects(
          compactParams({ page: 1, pageSize: 200 }),
        ),
      );
      const items = [...(res.items ?? [])];
      // 检测项目按 sortOrder 升序展示
      items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      this.objects.set(items);
      // 默认选中第一个
      this.selectedCode.update((prev) => prev ?? items[0]?.code ?? null);
    } finally {
      this.objectsReady.set(true);
    }
    // react useEffect 链第二跳：selectedCode 就绪后触发列表加载（无选中则
    // load() 的空分支自己落定 loading，避免整页加载态卡死）
    await this.load();
  }

  selectObject(code: string): void {
    if (code === this.selectedCode()) return;
    this.selectedCode.set(code);
    void this.load();
  }

  async load(): Promise<void> {
    const code = this.selectedCode();
    if (!code) {
      this.items.set([]);
      // B6 加载态：无选中对象分支也必须落定，避免整页加载态卡死
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.resource().list({
          page: 1,
          pageSize: 200,
          inspectionObjectCode: code,
        }),
      );
      const items = [...(res.items ?? [])];
      items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      this.items.set(items);
    } catch (e) {
      this.error.set((e as Error).message || "加载失败");
    } finally {
      this.loading.set(false);
    }
  }

  // @entry M04.F06.I02
  // @entry M04.F07.I02
  // @entry M04.F08.I02
  // @entry M04.F09.I02
  openCreate(): void {
    void this.openForm(null);
  }

  openEdit(item: CatalogRow): void {
    void this.openForm(item);
  }

  /** 弹窗标题基础词：去尾「管理/维护」（react title.replace 同款）→ 型号/规格/等级/牌号。 */
  get formBaseTitle(): string {
    return this.title().replace(/(管理|维护)/, "");
  }

  private async openForm(editing: CatalogRow | null): Promise<void> {
    const ref = this.dialog.open(CategoryDictFormDialogComponent, {
      width: "30rem",
      data: {
        editing,
        objects: this.objects(),
        baseTitle: this.formBaseTitle,
        resource: this.resource(),
      },
    });
    const saved = (await firstValueFrom(ref.afterClosed())) as boolean | undefined;
    if (saved) {
      await this.load();
    }
  }

  // @entry M04.F06.I04
  // @entry M04.F07.I04
  // @entry M04.F08.I04
  // @entry M04.F09.I03
  // @entry M04.F09.I04
  askDelete(item: CatalogRow): void {
    const ref = this.dialog.open(CategoryDictConfirmDialogComponent, {
      width: "26rem",
      data: { name: item.name },
    });
    void firstValueFrom(ref.afterClosed()).then(async (ok) => {
      if (!ok) return;
      try {
        await this.resource().remove(item.code);
        await this.load();
      } catch (e) {
        this.error.set((e as { message?: string }).message || "删除失败");
      }
    });
  }

  /** 拖拽结束：交换前端顺序 + 并行 PUT 所有受影响项的 sortOrder（code 寻址）。 */
  async drop(event: CdkDragDrop<CatalogRow[]>): Promise<void> {
    const { previousIndex, currentIndex } = event;
    if (previousIndex === currentIndex) return;
    const next = [...this.items()];
    moveItemInArray(next, previousIndex, currentIndex);
    this.items.set(next); // 立即反馈
    try {
      await Promise.all(
        next.map((item, idx) =>
          this.resource().update(item.code, { sortOrder: (idx + 1) * 10 }),
        ),
      );
    } catch (e) {
      this.error.set((e as { message?: string }).message || "排序保存失败");
      // 失败时回滚到服务端顺序
      await this.load();
    }
  }
}

/** 表单弹窗（新建/编辑共用；react ConfirmModal 表单语义等价；资源由宿主注入）。 */
@Component({
  selector: "app-category-dict-form-dialog",
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
      {{ data.editing ? "编辑" + data.baseTitle : "新建" + data.baseTitle }}
    </h2>
    <mat-dialog-content>
      @if (saveError(); as err) {
        <div role="alert" class="save-error">{{ err }}</div>
      }
      <div class="fields">
        <mat-form-field>
          <mat-label>检测项目</mat-label>
          <mat-select [(ngModel)]="body.inspectionObjectCode" [disabled]="!!data.editing">
            @for (o of data.objects; track o.code) {
              <mat-option [value]="o.code">{{ o.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>编码</mat-label>
          <input
            matInput
            name="code"
            [(ngModel)]="body.code"
            [disabled]="!!data.editing"
          />
        </mat-form-field>
        <mat-form-field>
          <mat-label>名称</mat-label>
          <input matInput name="name" [(ngModel)]="body.name" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>备注</mat-label>
          <input matInput name="remark" [(ngModel)]="body.remark" />
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">取消</button>
      <button mat-button (click)="submit()">{{ data.editing ? "保存" : "创建" }}</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
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
        gap: 0.25rem;
      }
      mat-form-field {
        width: 100%;
      }
    `,
  ],
})
export class CategoryDictFormDialogComponent {
  readonly data: {
    editing: CatalogRow | null;
    objects: InspectionObject[];
    baseTitle: string;
    resource: CatalogResource;
  } = inject(MAT_DIALOG_DATA);
  readonly ref =
    inject<MatDialogRef<CategoryDictFormDialogComponent, boolean>>(MatDialogRef);

  readonly saveError = signal<string | null>(null);

  body = {
    inspectionObjectCode:
      this.data.editing?.inspectionObjectCode ?? this.data.objects[0]?.code ?? "",
    code: this.data.editing?.code ?? "",
    name: this.data.editing?.name ?? "",
    remark: this.data.editing?.remark ?? "",
  };

  /** code 留空走后端 coerce 生成（nextjs 同款；契约 code 必填由 coerce 兜住，
   *  弹窗不设前置守卫——三端 spec 不填代码字段）。 */
  async submit(): Promise<void> {
    if (!this.body.inspectionObjectCode || !this.body.name.trim()) return;
    this.saveError.set(null);
    try {
      if (this.data.editing) {
        await this.data.resource.update(this.data.editing.code, {
          name: this.body.name.trim(),
          remark: this.body.remark,
        });
      } else {
        await this.data.resource.create({
          code: this.body.code.trim(),
          inspectionObjectCode: this.body.inspectionObjectCode,
          name: this.body.name.trim(),
          remark: this.body.remark,
        });
      }
      this.ref.close(true);
    } catch (e) {
      this.saveError.set((e as { message?: string }).message || "保存失败");
    }
  }
}

/** 删除确认弹窗（react ConfirmModal 等价：标题「删除确认」）。 */
@Component({
  selector: "app-category-dict-confirm-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>删除确认</h2>
    <mat-dialog-content>
      <p>确定删除「{{ data.name }}」？</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">取消</button>
      <button mat-button class="danger" (click)="ref.close(true)">确认</button>
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
export class CategoryDictConfirmDialogComponent {
  readonly data: { name: string } = inject(MAT_DIALOG_DATA);
  readonly ref =
    inject<MatDialogRef<CategoryDictConfirmDialogComponent, boolean>>(MatDialogRef);
}
