// 参数界面模型注册表（M03.F03）。L-T3③ 扩容中：default + cement 双卡 + concrete 双卡
// + welding 双卡 + rebar-mech + particle 已进；余 soil 双卡随族陆续进。
// 移植自 lab-management-system-react/src/features/data-entry/models/registry.ts
//（REQ-2026-031 L-T3③；resolve 未命中回退 default 语义 1:1）。
import type { Type } from "@angular/core";

import { CementCompressCardComponent } from "./cement-compress-card";
import { CementFlexuralCardComponent } from "./cement-flexural-card";
import { ConcreteCompressCardComponent } from "./concrete-compress-card";
import { ConcretePermeabilityCardComponent } from "./concrete-permeability-card";
import { DefaultParamCardComponent } from "./default-param-card";
import { RebarWeldingTensileCardComponent } from "./rebar-welding-tensile-card";
import { RebarWeldingBendCardComponent } from "./rebar-welding-bend-card";
import { RebarMechNumericCardComponent } from "./rebar-mech-numeric-card";
import { ParticleGradationCardComponent } from "./particle-gradation-card";

export type ParamModelComponent = Type<unknown>;

export const MODEL_REGISTRY: Record<string, ParamModelComponent> = {
  default: DefaultParamCardComponent,
  "concrete-compress": ConcreteCompressCardComponent,
  "concrete-permeability": ConcretePermeabilityCardComponent,
  "cement-compress": CementCompressCardComponent,
  "cement-flexural": CementFlexuralCardComponent,
  "rebar-welding-tensile": RebarWeldingTensileCardComponent,
  "rebar-welding-bend": RebarWeldingBendCardComponent,
  "rebar-mech-numeric": RebarMechNumericCardComponent,
  "particle-gradation": ParticleGradationCardComponent,
};

export function resolveParamInterfaceModel(key?: string): ParamModelComponent {
  return (key && MODEL_REGISTRY[key]) || DefaultParamCardComponent;
}
