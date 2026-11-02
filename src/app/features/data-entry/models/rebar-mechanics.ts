// 来源：lab-management-system-shared/mocks/domain/rebar-mechanics.ts（逐字拷入，无 import，零改动）。
// REF 的本文件是 `export * from '../../../../shared/mocks/domain/rebar-mechanics'` re-export 壳；
// 本仓家族 shared v0.2.0 已瘦身无 mocks/domain，故去壳直拷实现。

/**
 * 钢筋力学性能 / 机械连接 通用多组录入卡（rebar-mech-numeric）的纯计算层。
 *
 * 与 rebarWelding.ts（JGJ/T 27 焊接，固定 3 试件 + 断口距/断裂特征）区分：
 * 本模块面向 GB/T 228.1 力学性能与 JGJ 107 机械连接，组数由 calcRule.specimenCount 驱动（常见 2 组），
 * 无断口距 / 无断裂特征。
 *
 * TestRecord.result 存为 JSON（RebarMechResult）：
 *   { diameter?, techReqId?, techReqLabel?, loads, strengths, mean? }
 * 其中 strengths 为每组结果数组（拉伸/屈服 = MPa；伸长率 = %；比值 = 无量纲），
 * 复用字段名 strengths 以兼容报告模板 `record:IP-0087:strengths[N]`。
 */

export type RebarMechFormula =
  | "tensile_strength"
  | "yield_strength"
  | "passthrough"
  | "ratio_tensile_over_yield"
  | "ratio_measured_over_spec_yield";

export interface RebarMechResult {
  /** 公称直径 d (mm)；仅拉伸/屈服用；0/未填 */
  diameter?: number;
  techReqId?: string;
  techReqLabel?: string;
  /** 每组原始输入（拉伸/屈服 = 最大力 kN；伸长率/比值手动录入时 = 结果本身） */
  loads: number[];
  /** 每组结果（MPa / % / 比值）；未填/无效 = 0 */
  strengths: number[];
  /** 代表值（有效组均值） */
  mean?: number;
  /** 每试件断裂位置（机械连接 tensile 专用）。与 strengths 等长；未填 = ""。 */
  fractureLocations?: string[];
}

/** 圆整 0.1（MPa / %）。 */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 圆整 0.01（强屈比 / 超强比）。 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 抗拉/屈服强度 R = 4000·F / (π·d²)；F 单位 kN，d 单位 mm。
 * d≤0 或 F≤0 → 0（按未填处理）。GB/T 228.1 拉伸/屈服同一 UI 口径（力/公称面积）。
 */
export function strengthFromLoad(loadKn: number, diameterMm: number): number {
  if (!Number.isFinite(loadKn) || loadKn <= 0) return 0;
  if (!Number.isFinite(diameterMm) || diameterMm <= 0) return 0;
  return round1((4000 * loadKn) / (Math.PI * diameterMm ** 2));
}

/** 每组 载荷(kN) + 直径 → 强度(MPa)。 */
export function computeStrengths(loads: number[], diameterMm: number): number[] {
  return loads.map((l) => strengthFromLoad(l, diameterMm));
}

/** 强屈比[i] = 抗拉[i] / 屈服[i]；任一无效 → 0。 */
export function ratioTensileOverYield(
  tensile: number[],
  yields: number[],
  count: number,
): number[] {
  return Array.from({ length: count }, (_, i) => {
    // noUncheckedIndexedAccess: arr[i] → T | undefined；NaN 兜底使既有 isFinite 守卫生效
    const t = tensile[i] ?? NaN;
    const y = yields[i] ?? NaN;
    if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(y) || y <= 0) return 0;
    return round2(t / y);
  });
}

/** 超强比[i] = 实测屈服[i] / 标准屈服值；无标准值或无效 → 0。 */
export function ratioMeasuredOverSpec(
  yields: number[],
  specYield: number | undefined,
  count: number,
): number[] {
  return Array.from({ length: count }, (_, i) => {
    const y = yields[i] ?? NaN;
    if (!Number.isFinite(y) || y <= 0 || !specYield || specYield <= 0) return 0;
    return round2(y / specYield);
  });
}

/** 有效组（>0）算术均值；无有效值 → undefined。round 决定精度（0.1 / 0.01）。 */
export function meanOf(
  values: number[],
  round: (n: number) => number,
): number | undefined {
  const valid = values.filter((v) => Number.isFinite(v) && v > 0);
  if (valid.length === 0) return undefined;
  return round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

/** 比值类 formula 用 round2，其余用 round1。 */
export function rounderFor(formula: RebarMechFormula): (n: number) => number {
  return formula === "ratio_tensile_over_yield" ||
    formula === "ratio_measured_over_spec_yield"
    ? round2
    : round1;
}

/** 空结果（初始 state）：loads/strengths 定长补零。 */
export function emptyRebarMechResult(count: number): RebarMechResult {
  return {
    diameter: 0,
    techReqId: "",
    techReqLabel: "",
    loads: Array.from({ length: count }, () => 0),
    strengths: Array.from({ length: count }, () => 0),
    mean: undefined,
    fractureLocations: Array.from({ length: count }, () => ""),
  };
}

/** 反解析 RebarMechResult JSON；定长为 count；解析失败/空 → emptyRebarMechResult。 */
export function parseRebarMechResult(
  raw: string | undefined,
  count: number,
): RebarMechResult {
  const empty = emptyRebarMechResult(count);
  if (!raw) return empty;
  try {
    const obj = JSON.parse(raw) as Partial<RebarMechResult>;
    if (!obj || typeof obj !== "object") return empty;
    const fix = (arr: unknown): number[] =>
      Array.from({ length: count }, (_, i) => {
        const v = Array.isArray(arr) ? arr[i] : undefined;
        return typeof v === "number" && Number.isFinite(v) ? v : 0;
      });
    const fixStr = (arr: unknown): string[] =>
      Array.from({ length: count }, (_, i) => {
        const v = Array.isArray(arr) ? arr[i] : undefined;
        return typeof v === "string" ? v : "";
      });
    return {
      diameter: typeof obj.diameter === "number" ? obj.diameter : 0,
      techReqId: typeof obj.techReqId === "string" ? obj.techReqId : "",
      techReqLabel: typeof obj.techReqLabel === "string" ? obj.techReqLabel : "",
      loads: fix(obj.loads),
      strengths: fix(obj.strengths),
      mean: typeof obj.mean === "number" ? obj.mean : undefined,
      fractureLocations: fixStr(obj.fractureLocations),
    };
  } catch {
    return empty;
  }
}

/** 从任意记录 result JSON 抽出 strengths 数组（供比值卡跨记录联立读取 IP-0087/IP-0086）。 */
export function strengthsFromRecordResult(raw: string | undefined): number[] {
  if (!raw) return [];
  try {
    const obj = JSON.parse(raw) as { strengths?: unknown };
    return Array.isArray(obj.strengths)
      ? obj.strengths.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0))
      : [];
  } catch {
    return [];
  }
}
