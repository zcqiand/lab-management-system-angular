// 参数界面模型共享类型（M03.F03）。
// 移植自 lab-management-system-react/src/features/data-entry/models/types.ts
//（REQ-2026-031 L-T3②；react ParamModelProps 全量在 L-T3③ 域卡批补齐，
// 本批先收 techReqKey / requirementLabel / ParamCardPatch 三个共享件）。
import type { TestRecord } from "../../../../api/endpoints/model/testRecord";
import type { TechnicalRequirement } from "../../../../api/endpoints/model/technicalRequirement";

/** 技术要求下拉的 option key：判定标准|牌号|型号|等级|规格（react techReqKey 同款）。 */
export function techReqKey(r: TechnicalRequirement): string {
  return [
    r.judgmentStandardCode,
    r.brand ?? "",
    r.model ?? "",
    r.grade ?? "",
    r.spec ?? "",
  ].join("|");
}

/** 技术要求的人类可读标签：区间/上下限/目标值/表达式逐级回退（react 同款）。 */
export function requirementLabel(r: TechnicalRequirement): string {
  const unit = r.unit ? ` ${r.unit}` : "";
  if (
    (r.valueType === "range" || r.comparison === "range") &&
    r.minValue != null &&
    r.maxValue != null
  ) {
    return `${r.minValue} ~ ${r.maxValue}${unit}`;
  }
  if (r.comparison === "≥" && r.minValue != null) return `≥ ${r.minValue}${unit}`;
  if (r.comparison === "≤" && r.maxValue != null) return `≤ ${r.maxValue}${unit}`;
  if (r.targetValue)
    return `${r.comparison === "=" || r.comparison === "eq" ? "= " : ""}${r.targetValue}${unit}`;
  if (r.expression) return r.expression;
  const parts = [r.comparison, r.minValue ?? r.maxValue ?? r.targetValue]
    .filter(Boolean)
    .join(" ");
  return parts ? `${parts}${unit}` : r.remark || "—";
}

/** 卡片 onChange 回传的局部补丁（test-records 请求体字段子集）。 */
export type ParamCardPatch = Partial<
  Pick<
    TestRecord,
    "standardCode" | "requirementCode" | "requirement" | "result" | "verdict"
  >
>;

/**
 * 钢筋力学性能「比值卡」（强屈比/超强比）跨记录联立入参：
 * 强屈比[i] = tensileStrengths[i] / yieldStrengths[i]；
 * 超强比[i] = yieldStrengths[i] / specStandardYield（标准屈服值 = IP-0086 技术要求 minValue）。
 * 由 EntryModal 从同一样品已保存的 IP-0087/IP-0086 记录 + 技术要求解析而来；
 * 缺值时卡片回退手动录入（EntryModal 本批不接线，L-T3③ 与 react 1:1 同为缺省）。
 */
export interface CrossRecordInput {
  tensileStrengths?: number[];
  yieldStrengths?: number[];
  specStandardYield?: number;
}

/** 该参数的计算方法（M06.F05）切片——仅取 specimenCount 驱动「做几组数据」。 */
export interface CalcRuleRef {
  specimenCount: number;
}
