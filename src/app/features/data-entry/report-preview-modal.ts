// 报告预览：docxtemplater 填充 → docx-preview 渲染 → 打印/套打（M03.F01.I07 关联链）。
// 移植自 lab-management-system-react/src/features/data-entry/ReportPreviewModal.tsx
//（REQ-2026-031 L-T3③-tail，行为 1:1）。纯前端链路：模板取自 public/templates
//（与 react data/templates 同源镜像），浏览器内替换占位符，无后端。
// 当前报告类别无模板时，提示「没有报告模板」。
//
// angular 形态差异：
//   - react apiClient promise → orval service Observable（firstValueFrom）；
//     响应体无 {data} 包装，直接 `items`（react `r.data.items`）。
//   - use<X>State → signal；useEffect [open, receipt] → constructor effect；
//     useRef<HTMLDivElement> → viewChild。
//   - 组件常驻（宿主 @if(open) 控制），effect 内 open()/receipt() 双依赖同语义。
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { firstValueFrom } from "rxjs";
import { catchError, map, of } from "rxjs";

import { SamplesService } from "../../../api/endpoints/samples/samples.service";
import { TestRecordsService } from "../../../api/endpoints/test-records/test-records.service";
import type { SampleReceipt } from "../../../api/endpoints/model/sampleReceipt";
import type { Sample } from "../../../api/endpoints/model/sample";
import type { TestRecord } from "../../../api/endpoints/model/testRecord";
import type { ExtFieldDef } from "../../../api/endpoints/model/extFieldDef";
import generatedReportNames from "@/data/generated/inspection-report-name.json";
import {
  assembleReport,
  flattenForDocx,
  ensureAllDocxTagsFromBuffer,
  type OrgInfo,
} from "./report-template-data";
import { SampleExtFieldsModalComponent } from "./sample-ext-fields-modal";

/** 报告编号(RN) → 模板文件名（来自 generated/inspection-report-name.json 的 templatePath）。
 *  30 个 RN 全部已注入占位符并具备 templatePath。 */
const REPORT_NAME_TEMPLATE: Record<string, string> = Object.fromEntries(
  (generatedReportNames as Array<{ code: string; templatePath?: string }>)
    .filter((r) => r.templatePath)
    .map((r) => [r.code, r.templatePath as string]),
);

/** 报告编号(RN) → public/templates 下的模板 URL。
 *  REF（vite）用 import.meta.glob 把 data/templates/*.docx 发布成静态资源；
 *  nextjs / angular 移植：30 个 docx 已镜像到 public/templates/（与 templatePath
 *  一一对应），直接按文件名构 URL，无需 glob 查找表。无 templatePath 的类别
 *  返回 null → 组件走「暂无报告模板」分支。
 *  导出供测试断言 URL 直构行为。 */
export function pickTemplateUrl(categoryCode: string): string | null {
  const fname = REPORT_NAME_TEMPLATE[categoryCode];
  return fname ? `/templates/${encodeURIComponent(fname)}` : null;
}

@Component({
  selector: "app-report-preview-modal",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SampleExtFieldsModalComponent],
  template: `
    <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-70 p-4">
      <!-- 打印样式：A4 零边距，仅 #report-print-wrap 可见；预览与打印共用同一偏移。
           套打模式：把 docx-preview 渲染出的表格线透明掉，只留数据，用于打到预印刷空白表单。 -->
      <div
        class="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[94vh] flex flex-col"
      >
        <header class="flex items-center justify-between px-5 py-3 border-b">
          <h2 class="text-base font-semibold">
            报告预览{{ receipt().commissionCode ? " — " + receipt().commissionCode : "" }}
          </h2>
          <button
            type="button"
            (click)="closed.emit()"
            class="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </header>

        @if (noTemplate()) {
          <div class="p-10 text-center text-gray-500">
            当前报告类别（{{ receipt().categoryCode || "—" }}）暂无报告模板。
            <br />
            仅「混凝土抗压强度」类别支持预览，其他报告名称需要先在 data/templates
            下放入对应模板并注入占位符。
          </div>
        } @else {
          <div
            class="flex items-center gap-4 px-5 py-2 border-b text-xs text-gray-600 flex-wrap"
          >
            <label class="flex items-center gap-1">
              X 偏移(mm)
              <input
                type="number"
                [value]="offsetX()"
                (input)="offsetX.set(toNum($any($event.target).value))"
                class="w-16 border rounded px-1 py-0.5"
              />
            </label>
            <label class="flex items-center gap-1">
              Y 偏移(mm)
              <input
                type="number"
                [value]="offsetY()"
                (input)="offsetY.set(toNum($any($event.target).value))"
                class="w-16 border rounded px-1 py-0.5"
              />
            </label>
            <label class="flex items-center gap-1">
              <input
                type="checkbox"
                [checked]="overlay()"
                (change)="overlay.set($any($event.target).checked)"
              />
              套打模式（隐藏表格线，仅打数据）
            </label>
            <div class="flex-1"></div>
            <span class="text-gray-400">预览与打印共用同一组偏移</span>
          </div>

          @if (error(); as err) {
            <div class="px-5 py-2 text-sm text-red-600 bg-red-50">{{ err }}</div>
          }

          <div class="flex-1 overflow-auto bg-gray-100 p-4">
            @if (loading()) {
              <div class="text-sm text-gray-500 p-4">生成预览中...</div>
            }
            <div
              id="report-print-wrap"
              class="mx-auto bg-white shadow"
              [class.report-overlay]="overlay()"
              style="width: 210mm; min-height: 297mm"
            >
              <div
                [style.transform]="'translate(' + offsetX() + 'mm, ' + offsetY() + 'mm)'"
              >
                <div #docHost class="report-docx-host"></div>
              </div>
            </div>
          </div>

          <footer
            class="flex items-center justify-end gap-2 px-5 py-3 border-t bg-gray-50"
          >
            <button
              type="button"
              (click)="closed.emit()"
              class="px-4 py-1.5 text-sm border rounded hover:bg-gray-100"
            >
              关闭
            </button>
            <button
              type="button"
              (click)="print()"
              class="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              打印
            </button>
          </footer>
        }
      </div>
      <app-sample-ext-fields-modal
        [open]="extModalOpen()"
        [extFields]="extDraftFields()"
        [initialExt]="extDraftReady() ?? undefined"
        [loading]="loading()"
        (submitted)="handleExtSubmit($event)"
        (cancelled)="extModalOpen.set(false)"
      />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      /* 打印：A4 零边距，仅 #report-print-wrap 可见（react <style> 注入同语义）。 */
      @media print {
        @page {
          size: A4;
          margin: 0;
        }
        body * {
          visibility: hidden;
        }
        #report-print-wrap,
        #report-print-wrap * {
          visibility: visible;
        }
        #report-print-wrap {
          position: fixed;
          left: 0;
          top: 0;
          margin: 0;
          padding: 0;
          box-shadow: none !important;
        }
      }
      .report-overlay table,
      .report-overlay td,
      .report-overlay th {
        border-color: transparent !important;
      }
    `,
  ],
})
export class ReportPreviewModalComponent {
  readonly open = input(false);
  readonly receipt = input.required<SampleReceipt>();
  readonly closed = output<void>();

  private readonly samplesApi = inject(SamplesService);
  private readonly recordsApi = inject(TestRecordsService);

  private readonly docHost = viewChild<ElementRef<HTMLDivElement>>("docHost");

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly noTemplate = signal(false);
  readonly offsetX = signal(0);
  readonly offsetY = signal(0);
  readonly overlay = signal(false);
  // 类别级扩展属性补录弹窗（M03.F01.I07）：当 reportName.extFields 非空且当前样品
  // 未覆盖对应 key 时，先弹补录窗，提交后再渲染预览。
  readonly extModalOpen = signal(false);
  readonly extDraftReady = signal<Record<string, string> | null>(null);
  readonly extDraftSample = signal<Sample | null>(null);
  readonly extDraftFields = signal<ExtFieldDef[]>([]);

  /** run 令牌：open/receipt 变化重入时作废旧异步链（react cancelled flag 同语义）。 */
  private runToken = 0;

  constructor() {
    effect(() => {
      const receipt = this.receipt();
      if (!this.open() || !receipt) return;
      void this.run(receipt);
    });
  }

  print(): void {
    window.print();
  }

  /** 模板不可直调全局 Number——经组件方法转数值（偏移 mm 输入）。 */
  protected toNum(v: string): number {
    return Number(v);
  }

  private async run(receipt: SampleReceipt): Promise<void> {
    const token = ++this.runToken;
    this.error.set(null);
    const templateUrl = pickTemplateUrl(receipt.categoryCode);
    if (!templateUrl) {
      this.noTemplate.set(true);
      this.loading.set(false);
      return;
    }
    this.noTemplate.set(false);
    this.loading.set(true);
    try {
      // 样品 + 模板文件 并发拉取；检测记录按样品归集（见 recordsOfSamples）。
      // 机构信息：契约无 org-info 端点（GAP），org 恒 null，模板机构字段留空。
      const [samples, tplRes] = await Promise.all([
        firstValueFrom(
          this.samplesApi
            .samplesListSamples({ receiptId: receipt.id, page: 1, pageSize: 100 })
            .pipe(
              map((r) => r.items ?? []),
              catchError(() => of([] as Sample[])),
            ),
        ),
        fetch(templateUrl),
      ]);
      if (token !== this.runToken) return;
      if (!tplRes.ok) throw new Error("模板加载失败：" + tplRes.status);
      const records = await this.recordsOfSamples(samples.map((s) => s.id));
      if (token !== this.runToken) return;
      const org: OrgInfo | null = null;

      // 类别级扩展属性补录决策：当前类别若有 extFields 且首个样品未覆盖，
      // 弹窗先开；保存后再继续渲染。
      // 种子 JSON 的 extFields 条目可能省略 type（契约 ExtFieldDef.type 必填），
      // 边界处归一为 "text"（与 SampleExtFieldsModal 的 `f.type ?? "text"` 同语义）。
      const rname = (
        generatedReportNames as Array<{
          code: string;
          extFields?: Array<Omit<ExtFieldDef, "type"> & { type?: ExtFieldDef["type"] }>;
        }>
      ).find((r) => r.code === receipt.categoryCode);
      const extFields: ExtFieldDef[] = (rname?.extFields ?? []).map((f) => ({
        ...f,
        type: f.type ?? "text",
      }));
      const firstSample = samples[0] ?? null;
      const needExt =
        extFields.length > 0 &&
        !!firstSample &&
        extFields.some(
          (f) => f.source !== "receipt" && !(firstSample.ext && firstSample.ext[f.key]),
        );
      if (needExt && firstSample) {
        this.extDraftFields.set(extFields);
        this.extDraftSample.set(firstSample);
        this.extDraftReady.set(firstSample.ext ?? {});
        this.extModalOpen.set(true);
        this.loading.set(false);
        return;
      }

      await this.renderPreview({ templateUrl, samples, records, org, receipt });
    } catch (e: unknown) {
      if (token === this.runToken)
        this.error.set(e instanceof Error ? e.message : "预览失败");
    } finally {
      if (token === this.runToken) this.loading.set(false);
    }
  }

  /** 按样品归集检测记录——契约 list 端点只支持 sampleId/parameterCode 过滤
   *  （无 receiptId 参数），对样品集合逐个取再合并。 */
  private async recordsOfSamples(sampleIds: string[]): Promise<TestRecord[]> {
    const pages = await Promise.all(
      sampleIds.map((id) =>
        firstValueFrom(
          this.recordsApi
            .testRecordsListTestRecords({ sampleId: id, page: 1, pageSize: 200 })
            .pipe(
              map((p) => p?.items ?? []),
              catchError(() => of([] as TestRecord[])),
            ),
        ),
      ),
    );
    return pages.flatMap((p) => p);
  }

  private async renderPreview({
    templateUrl,
    samples,
    records,
    org,
    receipt: rcpt,
  }: {
    templateUrl: string;
    samples: Sample[];
    records: TestRecord[];
    org: OrgInfo | null;
    receipt: SampleReceipt;
  }): Promise<void> {
    const tplRes = await fetch(templateUrl);
    if (!tplRes.ok) throw new Error("模板加载失败：" + tplRes.status);
    const arrayBuffer = await tplRes.arrayBuffer();
    // 预览合成：模板（103/104/110 等）的「样品名称」cell 来自 sample.sampleName，
    // 但用户在样品管理里实际录入的是 型号 / 等级 / 牌号（sample.model/grade/brand），
    // 这两个字段对不上 → 预览跟数据录入「压根不匹配」。
    // 这里把首样品的 sampleName 合成成 `${model} ${grade} ${brand}`，
    // 优先取 sample.ext.sampleModel/sampleGrade/sampleBrand（extFields 补录的），
    // 再回退到 sample 内建字段，最后才用 sampleName 原值。
    // 不改 DB；只改本次预览用的内存对象。
    // （型号/等级/牌号本身由 SampleManagerModal 收集在 sample.model/grade/brand；
    // 不再作为 InspectionReportName.extFields 由「检测报告名称扩展属性维护」维护——
    // 它们是样品事实，不该走报告类别配置层。）
    const displaySamples = applyComposedSampleName(samples);
    const data = assembleReport({ receipt: rcpt, samples: displaySamples, records, org });
    const fname = REPORT_NAME_TEMPLATE[rcpt.categoryCode];
    const basename = fname ? fname.replace(/\.docx$/, "") : null;
    const flat = flattenForDocx(
      rcpt.categoryCode,
      basename,
      data,
      displaySamples,
      records,
    );
    // 兜底：manifest 漏登记的 {tag} 也补成「—」，避免 docxtemplater 渲染 "undefined"。
    await ensureAllDocxTagsFromBuffer(flat, arrayBuffer);
    const PizZip = (await import("pizzip")).default;
    const Docxtemplater = (await import("docxtemplater")).default;
    const { renderAsync } = await import("docx-preview");
    const zip = new PizZip(arrayBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(flat);
    const filled = doc.getZip().generate({ type: "uint8array" });
    const host = this.docHost()?.nativeElement;
    if (!host) return;
    host.innerHTML = "";
    await renderAsync(filled, host, undefined, {
      inWrapper: false,
    });
  }

  // 补录提交：合并 ext → 调 PUT /api/samples/:id/ext → 用合并后的 samples 重新渲染。
  protected async handleExtSubmit(mergedExt: Record<string, string>): Promise<void> {
    const target = this.extDraftSample();
    if (!target) {
      this.extModalOpen.set(false);
      return;
    }
    try {
      this.loading.set(true);
      await firstValueFrom(
        this.samplesApi.samplesUpdateSampleExt(target.id, { ext: mergedExt }),
      );
      const updatedSamples: Sample[] = [{ ...target, ext: mergedExt }];
      const templateUrl = pickTemplateUrl(this.receipt().categoryCode);
      if (!templateUrl) {
        this.extModalOpen.set(false);
        this.noTemplate.set(true);
        return;
      }
      // 重新拉一次该样品的 records（org 契约无端点，恒 null——见 run() 注释）。
      const records = await this.recordsOfSamples(updatedSamples.map((s) => s.id));
      await this.renderPreview({
        templateUrl,
        samples: updatedSamples,
        records,
        org: null,
        receipt: this.receipt(),
      });
      this.extModalOpen.set(false);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : "保存补录失败");
    } finally {
      this.loading.set(false);
    }
  }
}

/**
 * 预览用：把首个样品的 `sampleName` 合成成 `${model} ${grade} ${brand}`，
 * 直接取 `Sample.model/grade/brand`（SampleManagerModal 已收集）。
 * 兼容：若 ext 仍残留旧 extFields 补录值（sampleModel/sampleGrade/sampleBrand），
 * 优先 ext（历史数据迁移期）。不改 DB；只改本次预览用的内存对象。
 */
export function applyComposedSampleName(samples: Sample[]): Sample[] {
  if (samples.length === 0) return samples;
  const s0 = samples[0]!;
  const ext = (s0 as unknown as { ext?: Record<string, string> }).ext ?? {};
  // noPropertyAccessFromIndexSignature（angular 侧比 react 严）：索引签名走方括号。
  const model = ext["sampleModel"] ?? s0.model ?? "";
  const grade = ext["sampleGrade"] ?? s0.grade ?? "";
  const brand = ext["sampleBrand"] ?? s0.brand ?? "";
  const composed = [model, grade, brand].filter((p) => p.trim() !== "").join(" ");
  if (!composed) return samples;
  const updated: Sample = { ...s0, sampleName: composed } as Sample;
  return [updated, ...samples.slice(1)];
}
