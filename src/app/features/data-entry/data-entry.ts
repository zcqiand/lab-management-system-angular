// M03.F03 数据录入 — 流程线第三环节（flowStatus='data_entry'）。列表 + 录入弹窗。
// 移植自 lab-management-system-react/src/features/data-entry/DataEntryPage.tsx
//（REQ-2026-031 L-T3②，行为 1:1；react Dialog → MatDialog，toast → 页内提示条）。
//
// EntryModal 移植要点：
//   - 样品 + 参数并发拉，检测记录按样品归集（契约只支持 sampleId 过滤）
//   - dirtyKeys 脏键守卫：refetch 不覆盖用户在途输入；整体替换前把脏键从旧
//     state 合并回来（e2e AC-4 实证的 PUT/GET 竞态，语义必须 1:1 保住）
//   - 参数卡经 NgComponentOutlet 渲染（registry L-T3② 仅 default 兜底卡）
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { NgComponentOutlet } from "@angular/common";
import { RouterLink } from "@angular/router";
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
import { SamplesService } from "../../../api/endpoints/samples/samples.service";
import { InspectionDictionaryService } from "../../../api/endpoints/inspection-dictionary/inspection-dictionary.service";
import { TestRecordsService } from "../../../api/endpoints/test-records/test-records.service";
import { compactParams } from "../../../api/params";
import type { FlowStatus } from "../../../api/endpoints/model/flowStatus";
import type { SampleReceipt } from "../../../api/endpoints/model/sampleReceipt";
import type { Sample } from "../../../api/endpoints/model/sample";
import type { InspectionParameter } from "../../../api/endpoints/model/inspectionParameter";
import type { InspectionStandard } from "../../../api/endpoints/model/inspectionStandard";
import type { StandardParameterLink } from "../../../api/endpoints/model/standardParameterLink";
import type { TechnicalRequirement } from "../../../api/endpoints/model/technicalRequirement";
import type { TestRecord } from "../../../api/endpoints/model/testRecord";
import { resolveParamInterfaceModel } from "./models/registry";
import type { ParamModelComponent } from "./models/registry";
import type { ParamCardPatch } from "./models/types";

@Component({
  selector: "app-data-entry",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButtonModule,
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
          <!-- @entry M03.F03.I01 数据录入页 -->
          <h1>数据录入</h1>
          <p class="desc">M03.F03 样品检测数据录入与人工改判（flowStatus=data_entry）</p>
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
          <h3>待录入接样单（{{ total() || "…" }}）</h3>
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
                <td colspan="6" class="empty">（无待录入接样单）</td>
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
                <td>{{ r.assigneeName ?? "—" }}</td>
                <td>{{ r.plannedTestDate ?? "—" }}</td>
                <td class="stage">
                  {{ FLOW_STAGE_LABELS[r.flowStatus] ?? r.flowStatus }}
                </td>
                <td class="ops">
                  <!-- @entry M03.F03.I03 录入结果按钮开录入弹窗 -->
                  <button mat-button (click)="openEntry(r)" data-fn="M03.F03.I03">
                    录入结果
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
export class DataEntryComponent {
  protected readonly FLOW_STAGE_LABELS = FLOW_STAGE_LABELS;

  private readonly api = inject(ReceiptsService);
  private readonly dialog = inject(MatDialog);

  readonly items = signal<SampleReceipt[]>([]);
  readonly total = signal(0);
  readonly keyword = signal("");
  // B6 加载态：首屏即视为加载中（首帧不渲染空表壳；refetch 走 per-widget 加载中）
  readonly loading = signal(true);
  // toast.success/error 等价：页内提示条（保存后「检测记录已保存」/ 失败红条）
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
            flowStatus: "data_entry" as FlowStatus,
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

  openEntry(r: SampleReceipt): void {
    const ref = this.dialog.open(EntryDialogComponent, {
      width: "48rem",
      data: { receipt: r },
    });
    void firstValueFrom(ref.afterClosed()).then(async (saved) => {
      if (!saved) return;
      this.notice.set("检测记录已保存");
      await this.load();
    });
  }
}

/**
 * 录入结果弹窗（react EntryModal 1:1）：样品/检测参数双下拉 + 参数卡 + 保存。
 * 脏键守卫与旧 state 合并语义见文件头注释。
 */
@Component({
  selector: "app-data-entry-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgComponentOutlet,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>录入结果 — {{ data.receipt.commissionCode }}</h2>
    <mat-dialog-content>
      <p class="desc">选择样品 + 检测参数后填写检测结果与单项评定。</p>
      @if (error(); as err) {
        <div role="alert" class="save-error">{{ err }}</div>
      }
      @if (saveError(); as err) {
        <div role="alert" class="save-error">{{ err }}</div>
      }

      <div class="picks">
        <div>
          <label class="pick-label">样品</label>
          <select
            [value]="selectedSampleId()"
            (change)="selectedSampleId.set($any($event.target).value)"
          >
            @if (samples().length === 0) {
              <option value="">（无样品）</option>
            }
            @for (s of samples(); track s.id) {
              <option [value]="s.id" [selected]="s.id === selectedSampleId()">
                {{ s.sampleCode }}
              </option>
            }
          </select>
        </div>
        <div>
          <label class="pick-label">检测参数</label>
          <select
            [value]="activeParamCode()"
            (change)="onParamSelect($any($event.target).value)"
          >
            @if (parameters().length === 0) {
              <option value="">（无参数）</option>
            }
            @for (p of parameters(); track p.code) {
              <option [value]="p.code" [selected]="p.code === activeParamCode()">
                {{ p.canonicalName || p.name }}
              </option>
            }
          </select>
        </div>
      </div>

      <div class="model-area">
        @if (activeParam(); as p) {
          <ng-container *ngComponentOutlet="modelComp; inputs: cardInputs()" />
        } @else {
          <div class="no-param">暂无可用检测参数</div>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <!-- @entry M03.F03.I02 保存检测记录（样品/参数选定后可点） -->
      <button
        mat-button
        (click)="save()"
        [disabled]="submitting() || !selectedSampleId() || !activeParamCode()"
        data-fn="M03.F03.I02"
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
      .picks {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
        max-height: 60vh;
      }
      .pick-label {
        display: block;
        font-size: 0.75rem;
        color: #334155;
        margin-bottom: 0.25rem;
      }
      .picks select {
        width: 100%;
        height: 2.25rem;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0 0.5rem;
        font-size: 0.875rem;
        background: #ffffff;
      }
      .model-area {
        margin-top: 0.75rem;
      }
      .no-param {
        border: 1px solid #e2e8f0;
        border-radius: 0.25rem;
        padding: 1rem;
        font-size: 0.875rem;
        color: #94a3b8;
      }
    `,
  ],
})
export class EntryDialogComponent {
  readonly data: { receipt: SampleReceipt } = inject(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<EntryDialogComponent, boolean>>(MatDialogRef);

  private readonly receiptsApi = inject(ReceiptsService);
  private readonly samplesApi = inject(SamplesService);
  private readonly dictApi = inject(InspectionDictionaryService);
  private readonly recordsApi = inject(TestRecordsService);

  readonly samples = signal<Sample[]>([]);
  readonly parameters = signal<InspectionParameter[]>([]);
  readonly records = signal<Record<string, TestRecord>>({});
  readonly selectedSampleId = signal("");
  readonly activeParamCode = signal("");
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);

  // 脏键：弹窗内用户已输入但尚未保存的 `${sampleId}#${paramCode}`。
  // refetch 若无条件覆盖 records，会把用户刚敲的字静默冲回旧值（e2e AC-4 实证）。
  private readonly dirtyKeys = new Set<string>();

  readonly activeParam = signal<InspectionParameter | undefined>(undefined);

  readonly modelComp: ParamModelComponent = resolveParamInterfaceModel(
    this.data.receipt.categoryCode === "cement" ? "cement-compress" : "default",
  );

  protected readonly cardInputs = () => ({
    parameter: this.activeParam(),
    record: this.rec(),
    sampleId: this.selectedSampleId(),
    standards: [] as InspectionStandard[],
    stdParams: [] as StandardParameterLink[],
    techReqs: [] as TechnicalRequirement[],
    config: undefined,
    cardChange: (patch: ParamCardPatch) => this.onCardChange(patch),
    readOnly: false,
  });

  constructor() {
    void this.load();
  }

  private rec(): TestRecord | undefined {
    const sid = this.selectedSampleId();
    const code = this.activeParamCode();
    return sid && code ? this.records()[`${sid}#${code}`] : undefined;
  }

  /** 样品 + 参数并发；检测记录按样品归集（契约只支持 sampleId 过滤）。 */
  async load(): Promise<void> {
    this.dirtyKeys.clear();
    try {
      const [sItems, pItems] = await Promise.all([
        firstValueFrom(
          this.samplesApi.samplesListSamples(
            compactParams({ receiptId: this.data.receipt.id, page: 1, pageSize: 50 }),
          ),
        )
          .then((r) => (Array.isArray(r.items) ? r.items : []))
          .catch(() => [] as Sample[]),
        firstValueFrom(
          this.dictApi.inspectionDictionaryListParameters(
            compactParams({ page: 1, pageSize: 200 }),
          ),
        )
          .then((r) => (Array.isArray(r.items) ? r.items : []))
          .catch(() => [] as InspectionParameter[]),
      ]);
      const recordPages = await Promise.all(
        sItems.map((s) =>
          firstValueFrom(
            this.recordsApi.testRecordsListTestRecords(
              compactParams({ sampleId: s.id, page: 1, pageSize: 200 }),
            ),
          ).catch(() => null),
        ),
      );
      const tItems = recordPages.flatMap((p) =>
        p && Array.isArray(p.items) ? p.items : [],
      );
      this.samples.set(sItems);
      this.parameters.set(pItems);
      const map: Record<string, TestRecord> = {};
      for (const t of tItems) {
        const key = `${t.sampleId}#${t.parameterCode}`;
        // refetch 期间用户已输入的脏键不覆盖
        if (!this.dirtyKeys.has(key)) map[key] = t;
      }
      // 整体替换前把脏键从旧 state 合并回来，用户在途编辑不被冲掉
      const merged = { ...map };
      for (const key of this.dirtyKeys) {
        const prev = this.records()[key];
        if (prev) merged[key] = prev;
      }
      this.records.set(merged);
      if (sItems.length > 0) this.selectedSampleId.set(sItems[0]!.id);
      if (pItems.length > 0) {
        this.activeParamCode.set(pItems[0]!.code);
        this.activeParam.set(pItems[0]!);
      }
    } catch (err) {
      this.error.set((err as { message?: string }).message || "加载失败");
    }
  }

  /** 参数下拉切换时同步 activeParam（卡头/卡体依赖 parameter 对象）。 */
  protected onParamSelect(code: string): void {
    this.activeParamCode.set(code);
    this.activeParam.set(this.parameters().find((p) => p.code === code));
  }

  protected onCardChange(patch: ParamCardPatch): void {
    const sid = this.selectedSampleId();
    const code = this.activeParamCode();
    if (!sid || !code) return;
    const key = `${sid}#${code}`;
    this.dirtyKeys.add(key);
    this.records.update((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? ({} as TestRecord)),
        id: prev[key]?.id ?? "",
        sampleId: sid,
        parameterCode: code,
        ...patch,
      } as TestRecord,
    }));
  }

  async save(): Promise<void> {
    const sid = this.selectedSampleId();
    const code = this.activeParamCode();
    if (!sid || !code) return;
    this.submitting.set(true);
    this.saveError.set(null);
    try {
      const rec = this.rec();
      const body = {
        sampleId: sid,
        parameterCode: code,
        result: rec?.result ?? "",
        verdict: rec?.verdict ?? "",
        standardCode: rec?.standardCode ?? "",
        requirement: rec?.requirement ?? "",
      };
      if (rec?.id) {
        await firstValueFrom(this.recordsApi.testRecordsUpdateTestRecord(rec.id, body));
      } else {
        await firstValueFrom(this.recordsApi.testRecordsCreateTestRecord(body));
      }
      this.dirtyKeys.clear();
      this.ref.close(true);
    } catch (err) {
      this.saveError.set((err as { message?: string }).message || "保存失败");
    } finally {
      this.submitting.set(false);
    }
  }
}
