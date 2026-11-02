// 参数界面模型卡片的统一基类（M03.F03）。
// 移植自 lab-management-system-react/src/features/data-entry/models/types.ts 的
// ParamModelProps 契约（REQ-2026-031 L-T3③）：所有卡（default + 域卡）都继承，
// 保证 NgComponentOutlet inputs 九键全有落点（缺键的 input 静默不生效）。
// react 的 onChange 回调 prop 在此建模为 input 函数（默认 no-op），EntryDialog 经
// cardInputs 传入； NgComponentOutlet inputs 只认 @Input，不认 output，故不能用 output()。
import { Directive, input } from "@angular/core";

import type { InspectionParameter } from "../../../../api/endpoints/model/inspectionParameter";
import type { InspectionStandard } from "../../../../api/endpoints/model/inspectionStandard";
import type { StandardParameterLink } from "../../../../api/endpoints/model/standardParameterLink";
import type { TechnicalRequirement } from "../../../../api/endpoints/model/technicalRequirement";
import type { TestRecord } from "../../../../api/endpoints/model/testRecord";
import type { ParamCardPatch } from "./types";

/** 只读模式（详情页「检测数据」用）：true = 输入/select 灰化 + 上报被吞掉。 */
@Directive()
export abstract class ParamCardBase {
  readonly parameter = input.required<InspectionParameter>();
  readonly record = input<TestRecord | undefined>(undefined);
  /** 当前选中的样品 id——模型卡用此区分不同样品的本地状态（如强度卡的 loads）。 */
  readonly sampleId = input.required<string>();
  readonly standards = input<InspectionStandard[]>([]);
  readonly stdParams = input<StandardParameterLink[]>([]);
  readonly techReqs = input<TechnicalRequirement[]>([]);
  readonly config = input<Record<string, unknown> | undefined>(undefined);
  readonly readOnly = input(false);
  /** 把改动上报给父组件（EntryDialog）合并入 dirty 缓冲，由保存按钮统一落库。 */
  readonly cardChange = input<(patch: ParamCardPatch) => void>(() => {});
}
