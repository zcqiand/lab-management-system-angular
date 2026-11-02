// 类别级扩展属性补录弹窗（M03.F01.I07）。
// 移植自 lab-management-system-react/src/features/data-entry/SampleExtFieldsModal.tsx
//（REQ-2026-031 L-T3③-tail，行为 1:1）。
//
// 触发条件：当前接样单的 categoryCode 对应的 InspectionReportName.extFields 非空。
// 录入位置：仅 Sample.ext（本次实现）。后续若 extField.source === 'receipt'，
// 走 SampleReceipt 上的预留字段，下个 PR 接入。
//
// UI：每行 label + 对应控件（text/number/date/select）。
// 必填项未填 → 阻止提交（红框 + 错误文案）。
// angular 形态差异：react 由调用方以 `open` 布尔条件渲染整组件；本组件自持
// `open` input，@if 包裹全部渲染（宿主传 open 信号即可）；提交经 output
// `submitted` 上抛（react onSubmit 返回 Promise 由父 await——output 不可 await，
// 父组件自行 async，loading 经 input 回传同语义）。
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from "@angular/core";

import type { ExtFieldDef } from "../../../api/endpoints/model/extFieldDef";

@Component({
  selector: "app-sample-ext-fields-modal",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      @if (extFields().length === 0) {
        <!-- 防御：调用方应在 extFields 为空时直接不渲染弹窗。 -->
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          data-fn="M03.F01.I07"
        >
          <div class="bg-white rounded-lg shadow-xl w-96 max-w-[90vw] p-5">
            <p class="text-sm text-gray-600">当前报告类别没有需要补录的扩展属性。</p>
            <div class="flex justify-end mt-3">
              <button
                type="button"
                (click)="cancelled.emit()"
                class="px-3 py-1.5 text-sm border rounded hover:bg-gray-100"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      } @else {
        <div
          class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
          data-fn="M03.F01.I07"
          aria-modal="true"
          role="dialog"
          [attr.aria-label]="title()"
        >
          <form
            (submit)="$event.preventDefault(); handleSubmit()"
            class="bg-white rounded-lg shadow-xl w-md max-w-[92vw] max-h-[85vh] flex flex-col"
          >
            <div class="px-6 py-4 border-b border-gray-200">
              <h3 class="text-lg font-semibold">{{ title() }}</h3>
              <p class="text-xs text-gray-500 mt-1">
                补录结果会持久化到当前样品的扩展属性，下次预览自动带入。
              </p>
            </div>

            <div class="px-6 py-4 space-y-3 overflow-y-auto flex-1">
              @for (f of extFields(); track f.key) {
                <div>
                  <label
                    [htmlFor]="'ext-field-' + f.key"
                    class="block text-sm font-medium mb-1 text-gray-700"
                  >
                    {{ f.label }}
                    @if (f.required) {
                      <span class="text-red-500 ml-0.5">*</span>
                    }
                    <span class="ml-2 font-mono text-[10px] text-gray-400">
                      {{ "{" }}
                      {{ tagByKey()?.[f.key] ?? f.tag ?? f.key }}
                      {{ "}" }}
                    </span>
                  </label>
                  @switch (f.type ?? "text") {
                    @case ("select") {
                      <select
                        [id]="'ext-field-' + f.key"
                        [value]="draft()[f.key] ?? ''"
                        (change)="setValue(f.key, $any($event.target).value)"
                        class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">请选择</option>
                        @for (opt of f.options ?? []; track opt) {
                          <option [value]="opt">{{ opt }}</option>
                        }
                      </select>
                    }
                    @case ("number") {
                      <input
                        [id]="'ext-field-' + f.key"
                        type="number"
                        inputMode="decimal"
                        [value]="draft()[f.key] ?? ''"
                        (input)="setValue(f.key, $any($event.target).value)"
                        class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    }
                    @case ("date") {
                      <input
                        [id]="'ext-field-' + f.key"
                        type="date"
                        [value]="draft()[f.key] ?? ''"
                        (input)="setValue(f.key, $any($event.target).value)"
                        class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    }
                    @default {
                      <input
                        [id]="'ext-field-' + f.key"
                        type="text"
                        [value]="draft()[f.key] ?? ''"
                        (input)="setValue(f.key, $any($event.target).value)"
                        class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    }
                  }
                  @if (errors()[f.key]; as err) {
                    <p class="text-xs text-red-500 mt-1">{{ err }}</p>
                  }
                </div>
              }
            </div>

            <div class="px-6 py-3 flex justify-end gap-2 border-t border-gray-200">
              <button
                type="button"
                (click)="cancelled.emit()"
                [disabled]="loading()"
                class="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                (click)="handleSubmit()"
                [disabled]="loading()"
                class="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {{ loading() ? "保存中…" : "保存并预览" }}
              </button>
            </div>
          </form>
        </div>
      }
    }
  `,
})
export class SampleExtFieldsModalComponent {
  readonly open = input(false);
  /** 当前报告类别的 ext 字段定义（来自 InspectionReportName.extFields）。空数组 → 弹窗直接关闭。 */
  readonly extFields = input.required<ExtFieldDef[]>();
  /** 当前样品的 ext 现状（首次进入时填进表单），可能为空对象。 */
  readonly initialExt = input<Record<string, string> | undefined>(undefined);
  /** 模板中的占位符 tag → 字段 key 映射（extField.tag ?? extField.key）。补录说明用。 */
  readonly tagByKey = input<Record<string, string> | undefined>(undefined);
  /** 提交回调：上抛合并后的 ext，调用方负责持久化（PUT /api/samples/:id/ext）。 */
  readonly submitted = output<Record<string, string>>();
  readonly cancelled = output<void>();
  readonly loading = input(false);

  protected readonly draft = signal<Record<string, string>>({});
  protected readonly errors = signal<Record<string, string>>({});

  protected readonly title = computed(() => {
    if (this.extFields().length === 0) return "类别参数补录";
    return `类别参数补录（${this.extFields().length} 项）`;
  });

  constructor() {
    // 打开时用 initialExt 同步；extFields 列表变化时也重置，避免陈旧 key 残留。
    effect(() => {
      if (!this.open()) return;
      const next: Record<string, string> = {};
      for (const f of this.extFields()) next[f.key] = this.initialExt()?.[f.key] ?? "";
      this.draft.set(next);
      this.errors.set({});
    });
  }

  protected setValue(key: string, v: string): void {
    this.draft.update((d) => ({ ...d, [key]: v }));
  }

  protected validate(): boolean {
    const next: Record<string, string> = {};
    for (const f of this.extFields()) {
      if (!f.required) continue;
      const v = (this.draft()[f.key] ?? "").trim();
      if (!v) next[f.key] = "必填";
    }
    this.errors.set(next);
    return Object.keys(next).length === 0;
  }

  protected handleSubmit(): void {
    if (!this.validate()) return;
    const merged: Record<string, string> = { ...(this.initialExt() ?? {}) };
    for (const f of this.extFields()) {
      const v = (this.draft()[f.key] ?? "").trim();
      if (v) merged[f.key] = v;
    }
    this.submitted.emit(merged);
  }
}
