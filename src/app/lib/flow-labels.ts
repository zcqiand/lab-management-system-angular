// 流程阶段中文名（UI 展示字面）——FlowStatus 枚举值来自 orval model
// （src/api/endpoints/model/flowStatus），契约不携带展示标签，这里只做
// 值 → 中文文案的纯映射（非平行类型：不重复定义任何结构）。
// 移植自 lab-management-system-react/src/lib/flow-labels.ts（REQ-2026-031）。
import type { FlowStatus } from "../../api/endpoints/model/flowStatus";

export const FLOW_STAGE_LABELS: Record<FlowStatus, string> = {
  receiving: "接样中",
  task_assignment: "分配中",
  data_entry: "录入中",
  review: "审核中",
  approval: "批准中",
  issuance: "发放中",
  archived: "归档中",
  completed: "已归档",
};
