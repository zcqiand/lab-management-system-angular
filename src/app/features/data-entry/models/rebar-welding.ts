// 来源：lab-management-system-shared/mocks/domain/rebar-welding.ts（逐字拷入，无 import，零改动）。
// REF 的本文件是 `export * from '../../../../shared/mocks/domain/rebar-welding'` re-export 壳；
// 本仓家族 shared v0.2.0 已瘦身无 mocks/domain，故去壳直拷实现。

/**
 * 钢筋焊接接头（JGJ/T 27-2014）数据形态：
 * - 抗拉强度卡（rebar-welding-tensile）：1 样品 = 3 试件（JGJ/T 27 §6.1）。
 *   3 试件共享 1 条技术要求 + 1 个硬编码公称直径 Φ22；每试件 1 行 = 最大荷重(kN) → 抗拉强度(MPa) / 断口距(mm) / 断裂特征。
 *   注：d 不再录入——参数界面层硬编码 REBAR_DIAMETER_MM=22；若未来要支持 Φ16/Φ25 等规格，改从 ParamModelProps.config 读取。
 * - 弯曲性能卡（rebar-welding-bend）：1 样品 = 3 试件（JGJ/T 27 §6.2）。
 *   3 行 = 弯曲角度(deg) + 合格/不合格。
 *
 * TestRecord.result 存为 JSON：
 *   抗拉（TensileRecord）扁平：
 *     { techReqId, techReqLabel, loads, strengths, fractureDistances, fractureCharacteristics }
 *   弯曲（BendRecord）扁平：
 *     { angles, results }  ← 3 元素同层数组
 *
 * 抗拉强度（Rm, MPa） = F (N) / A (mm²)；A = π·d²/4 → Rm = 4000·F / (π·d²)，F 单位 kN，d 单位 mm。
 */

export const TRIAL_COUNT = 3;

/** 钢筋焊接接头抗拉强度公式中固定的公称直径（规格 Φ22）。
 *  REQ-2026-015：参数界面不再录入 d，硬编码 22；若未来需要支持其它规格，从 ParamModelProps.config 读取并去除此常量。 */
export const REBAR_DIAMETER_MM = 22;

/** 单个样品下的抗拉强度试件数据（三试件共享技术要求；公称直径硬编码 Φ22 不入存储）。 */
export interface TensileSpecimen {
  /** 该样品技术要求的 requirement.id（跨 3 试件共享） */
  techReqId: string;
  /** 该样品技术要求的显示文本 */
  techReqLabel: string;
  /** 3 试件的最大荷重 (kN)；0 = 未填 */
  loads: [number, number, number];
  /** 3 试件的抗拉强度 (MPa)；由 loads+REBAR_DIAMETER_MM 计算，未填/无效=0 */
  strengths: [number, number, number];
  /** 3 试件的断口距 (mm)；0 = 未填 */
  fractureDistances: [number, number, number];
  /** 3 试件的断裂特征（字符串枚举：母材断裂 / 焊缝断裂 / 热影响区断裂 / 其他） */
  fractureCharacteristics: [string, string, string];
}

export type TensileRecord = TensileSpecimen;

/** 单个样品下的弯曲数据（3 试件共享）。 */
export interface BendSpecimen {
  /** 3 试件的弯曲角度 (deg)，常见 90/180 */
  angles: [number, number, number];
  /** 3 试件的结果：「合格」/「不合格」 */
  results: [string, string, string];
}

export type BendRecord = BendSpecimen;

/** 空试件（用作 initial state）。 */
export const EMPTY_TENSILE: TensileSpecimen = {
  techReqId: "",
  techReqLabel: "",
  loads: [0, 0, 0],
  strengths: [0, 0, 0],
  fractureDistances: [0, 0, 0],
  fractureCharacteristics: ["", "", ""],
};

export const EMPTY_BEND: BendSpecimen = {
  angles: [90, 90, 90],
  results: ["合格", "合格", "合格"],
};

/** 圆整 0.1（MPa）。 */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * 抗拉强度 Rm = 4000·F / (π·d²)；F 单位 kN，d 单位 mm。
 * d≤0 或 F≤0 → 0（按未填处理）。
 */
export function tensileStrength(loadKn: number, diameterMm: number): number {
  if (!Number.isFinite(loadKn) || loadKn <= 0) return 0;
  if (!Number.isFinite(diameterMm) || diameterMm <= 0) return 0;
  return round1((4000 * loadKn) / (Math.PI * diameterMm ** 2));
}

/** 用 loads + 硬编码公称直径 REBAR_DIAMETER_MM 重算 strengths 并返回新试件。 */
export function recomputeStrengths(spec: TensileSpecimen): TensileSpecimen {
  return {
    ...spec,
    strengths: [
      tensileStrength(spec.loads[0], REBAR_DIAMETER_MM),
      tensileStrength(spec.loads[1], REBAR_DIAMETER_MM),
      tensileStrength(spec.loads[2], REBAR_DIAMETER_MM),
    ],
  };
}

/** 3 次强度的算术均值（无 ±10% 剔除——JGJ/T 27 无此规则）。 */
export function meanOfSpecimen(spec: TensileSpecimen): number | undefined {
  const valid = spec.strengths.filter((v) => Number.isFinite(v) && v > 0);
  if (valid.length === 0) return undefined;
  return round1(valid.reduce((a, b) => a + b, 0) / valid.length);
}

/** 反解析 TensileRecord JSON（扁平结构：直径/技术要求 顶层，3 试件数组同层）；解析失败/空 → 空 TensileRecord。 */
export function parseTensileRecord(raw: string | undefined): TensileRecord {
  if (!raw) return { ...EMPTY_TENSILE };
  try {
    const obj = JSON.parse(raw) as Partial<TensileSpecimen>;
    if (!obj) return { ...EMPTY_TENSILE };
    const loads = Array.isArray(obj.loads) ? obj.loads.slice(0, TRIAL_COUNT) : [0, 0, 0];
    const strengths = Array.isArray(obj.strengths)
      ? obj.strengths.slice(0, TRIAL_COUNT)
      : [0, 0, 0];
    const fractureDistances = Array.isArray(obj.fractureDistances)
      ? obj.fractureDistances.slice(0, TRIAL_COUNT)
      : [0, 0, 0];
    const fractureCharacteristics = Array.isArray(obj.fractureCharacteristics)
      ? obj.fractureCharacteristics.slice(0, TRIAL_COUNT)
      : ["", "", ""];
    return {
      techReqId: typeof obj.techReqId === "string" ? obj.techReqId : "",
      techReqLabel: typeof obj.techReqLabel === "string" ? obj.techReqLabel : "",
      loads: [
        typeof loads[0] === "number" ? loads[0] : 0,
        typeof loads[1] === "number" ? loads[1] : 0,
        typeof loads[2] === "number" ? loads[2] : 0,
      ] as [number, number, number],
      strengths: [
        typeof strengths[0] === "number" ? strengths[0] : 0,
        typeof strengths[1] === "number" ? strengths[1] : 0,
        typeof strengths[2] === "number" ? strengths[2] : 0,
      ] as [number, number, number],
      fractureDistances: [
        typeof fractureDistances[0] === "number" ? fractureDistances[0] : 0,
        typeof fractureDistances[1] === "number" ? fractureDistances[1] : 0,
        typeof fractureDistances[2] === "number" ? fractureDistances[2] : 0,
      ] as [number, number, number],
      fractureCharacteristics: [
        typeof fractureCharacteristics[0] === "string" ? fractureCharacteristics[0] : "",
        typeof fractureCharacteristics[1] === "string" ? fractureCharacteristics[1] : "",
        typeof fractureCharacteristics[2] === "string" ? fractureCharacteristics[2] : "",
      ] as [string, string, string],
    };
  } catch {
    return { ...EMPTY_TENSILE };
  }
}

const BEND_SPECIMEN_COUNT_LEGACY = 4;

/** 反解析 BendRecord JSON（扁平结构：3 试件 angles/results 同层数组）；解析失败/空 → EMPTY_BEND。
 * 兼容旧 `specimens[]` 数组格式（取 specimens[0] 作回退，保证历史数据不丢）。 */
export function parseBendRecord(raw: string | undefined): BendRecord {
  if (!raw) return { ...EMPTY_BEND };
  try {
    const obj = JSON.parse(raw) as Partial<BendSpecimen> & {
      specimens?: Array<Partial<BendSpecimen>>;
    };
    if (!obj) return { ...EMPTY_BEND };
    // 新扁平形态优先；旧 specimens[0] 回退
    const src: Partial<BendSpecimen> | undefined =
      Array.isArray(obj.angles) || Array.isArray(obj.results)
        ? obj
        : Array.isArray(obj.specimens)
          ? obj.specimens[0]
          : undefined;
    if (!src) return { ...EMPTY_BEND };
    const angles = Array.isArray(src.angles)
      ? src.angles.slice(0, TRIAL_COUNT)
      : [90, 90, 90];
    const results = Array.isArray(src.results)
      ? src.results.slice(0, TRIAL_COUNT)
      : ["合格", "合格", "合格"];
    return {
      angles: [
        typeof angles[0] === "number" ? angles[0] : 90,
        typeof angles[1] === "number" ? angles[1] : 90,
        typeof angles[2] === "number" ? angles[2] : 90,
      ] as [number, number, number],
      results: [
        results[0] === "不合格" ? "不合格" : "合格",
        results[1] === "不合格" ? "不合格" : "合格",
        results[2] === "不合格" ? "不合格" : "合格",
      ] as [string, string, string],
    };
  } catch {
    return { ...EMPTY_BEND };
  }
}
// 保留旧常量名以防外部 import；新代码不应再用
void BEND_SPECIMEN_COUNT_LEGACY;
