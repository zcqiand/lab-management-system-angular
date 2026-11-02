// 来源：lab-management-system-shared/mocks/domain/cement-strength.ts（逐字拷入）。
// 移植自 lab-management-system-react/src/features/data-entry/models/cement-strength.ts
//（REQ-2026-031 L-T3③，算法逐字 1:1，仅类型 import 路径改 orval 生成物）。
import type { TechnicalRequirement } from "../../../../api/endpoints/model/technicalRequirement";

/** 一次强度试验的计算产物。strengths/kept 与录入荷载同序、同长度。 */
export interface StrengthResult {
  /** 每个试件的强度 (MPa)，圆整 0.1；荷载缺失(0)对应 0。 */
  strengths: number[];
  /** ±10% 剔除后是否保留该试件；荷载缺失项恒 false。 */
  kept: boolean[];
  /** 代表值(有效值均值)，圆整 0.1；无有效值时 undefined。 */
  mean: number | undefined;
  /** GB/T 17671 作废：剔除后仍有幸存值超 ±10%。 */
  invalid: boolean;
}

/** 圆整到 0.1（GB/T 17671 强度口径）。 */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * 抗折强度 Rf = 1.5·F·L/b³（GB/T 17671，40×40×160mm 棱体）。
 * F=破坏荷载(N)=loadKn×1000；L=跨距(mm)；b=棱边(mm)。默认 L=100,b=40 → 系数 2.34375/kN。
 */
export function flexuralStrength(loadKn: number, span = 100, width = 40): number {
  return round1((1.5 * loadKn * 1000 * span) / width ** 3);
}

/**
 * 抗压强度 Rc = F/A（GB/T 17671，受压面 40×40mm）。
 * F=破坏荷载(N)=loadKn×1000；A=受压面积(mm²)。默认 A=1600 → 系数 0.625/kN。
 */
export function compressStrength(loadKn: number, area = 1600): number {
  return round1((loadKn * 1000) / area);
}

/**
 * GB/T 17671 ±10% 剔除：
 * 1. 以全部有效值均值 m 为基准，|v-m| > tol·m 的为离群，kept=false；
 * 2. 幸存者为空 → invalid，mean=undefined；
 * 3. 离群多于 1 个 → invalid（GB/T 17671 作废：超差值不止一个则整组无效），
 *    仍返回幸存者均值供展示；
 * 4. 代表值 = 幸存者均值，圆整 0.1。
 * 荷载缺失(≤0/非有限)不参与，kept 恒 false。
 */
export function reduceStrengths(
  strengths: number[],
  tol = 0.1,
): { mean: number | undefined; kept: boolean[]; invalid: boolean } {
  const isValid = (s: number) => Number.isFinite(s) && s > 0;
  const valid = strengths.filter(isValid);
  if (valid.length === 0)
    return { mean: undefined, kept: strengths.map(() => false), invalid: false };
  const m = valid.reduce((a, b) => a + b, 0) / valid.length;
  const kept = strengths.map((s) => isValid(s) && Math.abs(s - m) <= tol * m);
  const keptVals = valid.filter((s) => Math.abs(s - m) <= tol * m);
  if (keptVals.length === 0) return { mean: undefined, kept, invalid: true };
  const outlierCount = valid.length - keptVals.length;
  const m2 = keptVals.reduce((a, b) => a + b, 0) / keptVals.length;
  return { mean: round1(m2), kept, invalid: outlierCount > 1 };
}

/** 抗折：3 荷载(kN) → 强度 + ±10% 剔除均值。 */
export function computeCementFlexural(
  loads: number[],
  span = 100,
  width = 40,
): StrengthResult {
  const strengths = loads.map((l) =>
    Number.isFinite(l) && l > 0 ? flexuralStrength(l, span, width) : 0,
  );
  const { mean, kept, invalid } = reduceStrengths(strengths);
  return { strengths, kept, mean, invalid };
}

/** 抗压：6 荷载(kN) → 强度 + ±10% 剔除均值。 */
export function computeCementCompress(loads: number[], area = 1600): StrengthResult {
  const strengths = loads.map((l) =>
    Number.isFinite(l) && l > 0 ? compressStrength(l, area) : 0,
  );
  const { mean, kept, invalid } = reduceStrengths(strengths);
  return { strengths, kept, mean, invalid };
}

/**
 * 均值 vs 技术要求 → 合格/不合格；无法判定(无均值/无可比要求)返回 ''。
 * 支持 ≥(minValue) / ≤(maxValue) / range(min~max)。
 */
export function autoVerdict(
  mean: number | undefined,
  req: TechnicalRequirement | undefined,
): "合格" | "不合格" | "" {
  if (mean === undefined || !req) return "";
  const { comparison, minValue, maxValue, valueType } = req;
  if (comparison === "≥" && minValue != null) return mean >= minValue ? "合格" : "不合格";
  if (comparison === "≤" && maxValue != null) return mean <= maxValue ? "合格" : "不合格";
  if (
    (comparison === "range" || valueType === "range") &&
    minValue != null &&
    maxValue != null
  )
    return mean >= minValue && mean <= maxValue ? "合格" : "不合格";
  return "";
}

export interface ParsedStrengthRecord {
  loads: number[];
  strengths: number[];
  mean?: number;
  invalid?: boolean;
}

/** 反解析 TestRecord.result（本模型存的是 {loads,strengths,mean,invalid} JSON）。 */
export function parseStrengthRecord(raw: string | undefined): ParsedStrengthRecord {
  if (!raw) return { loads: [], strengths: [] };
  try {
    const obj = JSON.parse(raw) as ParsedStrengthRecord;
    return {
      loads: Array.isArray(obj.loads) ? obj.loads : [],
      strengths: Array.isArray(obj.strengths) ? obj.strengths : [],
      mean: obj.mean,
      invalid: obj.invalid,
    };
  } catch {
    return { loads: [], strengths: [] };
  }
}
