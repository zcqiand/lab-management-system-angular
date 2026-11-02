// 参数界面模型注册表（M03.F03）。L-T3③ 扩容中：default + cement 双卡 + concrete 双卡已进；
// 余 7 张域卡（rebar/soil/particle）随族陆续进。
// 移植自 lab-management-system-react/src/features/data-entry/models/registry.ts
//（REQ-2026-031 L-T3③；resolve 未命中回退 default 语义 1:1）。
import type { Type } from "@angular/core";

import { CementCompressCardComponent } from "./cement-compress-card";
import { CementFlexuralCardComponent } from "./cement-flexural-card";
import { ConcreteCompressCardComponent } from "./concrete-compress-card";
import { ConcretePermeabilityCardComponent } from "./concrete-permeability-card";
import { DefaultParamCardComponent } from "./default-param-card";

export type ParamModelComponent = Type<unknown>;

export const MODEL_REGISTRY: Record<string, ParamModelComponent> = {
  default: DefaultParamCardComponent,
  "concrete-compress": ConcreteCompressCardComponent,
  "concrete-permeability": ConcretePermeabilityCardComponent,
  "cement-compress": CementCompressCardComponent,
  "cement-flexural": CementFlexuralCardComponent,
};

export function resolveParamInterfaceModel(key?: string): ParamModelComponent {
  return (key && MODEL_REGISTRY[key]) || DefaultParamCardComponent;
}
