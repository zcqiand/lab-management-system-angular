// 参数界面模型注册表（M03.F03）。L-T3② 先立骨架：仅 default 兜底卡；
// L-T3③ 补 11 张域卡（concrete/cement/rebar/soil/particle）。
// 移植自 lab-management-system-react/src/features/data-entry/models/registry.ts
//（REQ-2026-031 L-T3②；resolve 未命中回退 default 语义 1:1）。
import type { Type } from "@angular/core";

import { DefaultParamCardComponent } from "./default-param-card";

export type ParamModelComponent = Type<unknown>;

export const MODEL_REGISTRY: Record<string, ParamModelComponent> = {
  default: DefaultParamCardComponent,
};

export function resolveParamInterfaceModel(key?: string): ParamModelComponent {
  return (key && MODEL_REGISTRY[key]) || DefaultParamCardComponent;
}
