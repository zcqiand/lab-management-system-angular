import generatedParameters from "@/data/generated/inspection-parameter.json";
import generatedTechReqs from "@/data/generated/inspection-technical-requirement.json";

/**
 * 技术要求（结构来自 inspection-technical-requirement.json）。
 * 仅声明 mock 生成器用到的字段；其余字段（brand/spec/grade 等）忽略。
 */
export interface TechReq {
  inspectionParameterCode: string;
  valueType: string;
  minValue?: number;
  maxValue?: number;
  comparison?: string;
  /** 等级（Ⅰ类/Ⅱ类/Ⅲ类…）。砂石类标准按类别给不同限值，报告要分列展示。 */
  grade?: string;
  /** 筛孔（颗粒级配 / 筛分试验专用，如 4.75mm / 2.36mm）。
   *  与 grade（= 级配区）联合唯一定位「区×筛孔」的累计筛余区间
   *  （GB/T 14684-2022 表 3 等二维限值表）；其他参数忽略。 */
  sieve?: string;
  remark?: string;
}

/** 报告里「技术要求」分类列的顺序（GB/T 14684 / GB/T 14685 等砂石标准通用）。 */
export const REQUIREMENT_GRADES = ["Ⅰ类", "Ⅱ类", "Ⅲ类"] as const;

interface Parameter {
  code: string;
  name: string;
}

const PARAMETERS = generatedParameters as readonly Parameter[];
const TECH_REQS = generatedTechReqs as readonly TechReq[];

const NAME_BY_CODE = new Map<string, string>(PARAMETERS.map((p) => [p.code, p.name]));

/** 关键字 → 单位 推断表（按顺序首匹配）。无匹配返回空串。 */
const UNIT_RULES: ReadonlyArray<{ re: RegExp; unit: string }> = [
  // 强度/力/应力 → MPa。注意：不含"模数/模量"——细度模数无单位，单独留空。
  { re: /强度|力|应力|抗拔|承载/, unit: "MPa" },
  { re: /含[水泥气]|含泥|含粉|含量|率|偏差|损失|饱和|吸附/, unit: "%" },
  { re: /凝结时间|时间/, unit: "min" },
  { re: /密度|容重/, unit: "kg/m³" },
  { re: /尺寸|直径|长度|厚度|间距|宽度|粒径/, unit: "mm" },
  { re: /质量|重量/, unit: "kg" },
  { re: /温度/, unit: "℃" },
];

/** 关键字 → 数值区间 推断表（用于无真技术要求时的 mock 值）。 */
const RANGE_RULES: ReadonlyArray<{ re: RegExp; min: number; max: number }> = [
  { re: /屈服|抗拉|抗拔/, min: 400, max: 550 }, // 钢筋类 MPa
  { re: /抗压强度/, min: 25, max: 50 }, // 混凝土/水泥 MPa
  { re: /抗折|抗拉强度/, min: 4, max: 8 },
  { re: /凝结时间/, min: 90, max: 300 },
  { re: /含泥|含粉|石粉|泥块/, min: 0.2, max: 2.8 },
  { re: /亚甲蓝/, min: 0.4, max: 1.3 }, // MB 值，GB/T 14684 以 1.4 为界
  { re: /针片状|贝壳|云母|轻物质|有机物|硫化物|硫酸盐/, min: 0.3, max: 6 },
  { re: /压碎/, min: 8, max: 22 },
  { re: /坚固性|质量损失/, min: 2, max: 8 },
  { re: /空隙率/, min: 38, max: 44 },
  { re: /吸水率/, min: 0.5, max: 3 },
  { re: /含水|含气/, min: 0.2, max: 4 },
  { re: /细度模数/, min: 2.3, max: 3.0 },
  { re: /密度|容重/, min: 2300, max: 2500 },
];

const DEFAULT_RANGE = { min: 1, max: 100 } as const;

/**
 * 百分比类参数在「无技术要求 + 无关键字命中」时的兜底区间。
 *
 * 原来一律落到 DEFAULT_RANGE(1..100)，于是报告里出现「泥块含量 61.4%」
 * 「亚甲蓝值 40.6」「压碎指标 61.5%」这类物理上不可能的演示值。
 * 百分比类参数绝大多数上限在个位数到十几，收窄到 0.5..8 至少量级可信。
 *
 * 注意：这只是演示数据的兜底，不是判定依据。真正的限值应补进
 * data/master-data/inspection-technical-requirements.csv，mockResult 会优先用它。
 */
const PERCENT_FALLBACK_RANGE = { min: 0.5, max: 8 } as const;

/** 未知 code（参数名查不到）的固定 fallback。 */
const UNKNOWN_RESULT: MockResult = { jcz: "—", dw: "", jd: "合格" };

export interface MockResult {
  jcz: string;
  dw: string;
  jd: string;
}

export function inferUnit(name: string): string {
  for (const r of UNIT_RULES) if (r.re.test(name)) return r.unit;
  return "";
}

/** 稳定哈希（非随机），保证同 code 同输出。 */
function hash(code: string): number {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return h;
}

/** 取该参数的真技术要求（5 条之一），无则 req 为 undefined。 */
/** 把一条技术要求渲染成「≤ 3.0」这类文案；无可比较值 → undefined。 */
function formatReq(req: TechReq | undefined): string | undefined {
  if (!req?.comparison) return undefined;
  const v = req.minValue ?? req.maxValue;
  if (v == null) return undefined;
  return `${req.comparison} ${v}`;
}

/**
 * 按等级取技术要求文案，供报告「技术要求」的 Ⅰ类/Ⅱ类/Ⅲ类 三列使用。
 *
 * 砂石类标准（GB/T 14684 建设用砂、GB/T 14685 建设用卵石碎石）对同一参数按类别
 * 给三档限值，模板里是 {pN_jz1}/{pN_jz2}/{pN_jz3} 三个独立单元格。此前只有单值
 * requirementFor()，三列全部未登记 manifest → 报告渲染成 undefined。
 *
 * 某等级查不到 → 返回空串（模板兜底成「—」），不拿别的等级顶替。
 */
export function requirementsByGrade(parameterCode: string): string[] {
  return REQUIREMENT_GRADES.map((g) => {
    const req = TECH_REQS.find(
      (t) => t.inspectionParameterCode === parameterCode && t.grade === g,
    );
    return formatReq(req) ?? "";
  });
}

export function requirementFor(parameterCode: string): {
  jz: string;
  req?: TechReq;
} {
  const req = TECH_REQS.find((t) => t.inspectionParameterCode === parameterCode);
  if (req && req.comparison && (req.minValue != null || req.maxValue != null)) {
    const v = req.minValue ?? req.maxValue ?? 0;
    return { jz: `${req.comparison} ${v}`, req };
  }
  return { jz: "符合相应标准要求" };
}

/**
 * 按「级配区 × 筛孔」唯一定位技术要求（GB/T 14684-2022 表 3 二维限值表专用）。
 * 返回 minValue~maxValue 渲染字符串（如 "0~10"）；无匹配 → undefined（模板兜底 "—"）。
 *
 * 与 requirementsByGrade 的差别：后者按 grade 一维取（jz1/jz2/jz3），本函数额外加
 * sieve 维度（4.75mm / 2.36mm / ...），用于颗粒级配报告里 1区/2区/3区 × 6 筛孔
 * 的 18 限值展示。
 */
export function requirementByZoneAndSieve(
  parameterCode: string,
  grade: string,
  sieve: string,
): string | undefined {
  const req = TECH_REQS.find(
    (t) =>
      t.inspectionParameterCode === parameterCode &&
      t.grade === grade &&
      t.sieve === sieve,
  );
  if (req?.minValue != null && req.maxValue != null) {
    return `${req.minValue}~${req.maxValue}`;
  }
  return undefined;
}

function inferRange(name: string): { min: number; max: number } {
  for (const r of RANGE_RULES) if (r.re.test(name)) return r;
  // 单位是 % 却没命中任何关键字 → 用百分比兜底，别落到 1..100
  if (inferUnit(name) === "%") return PERCENT_FALLBACK_RANGE;
  return DEFAULT_RANGE;
}

function decimals(min: number, max: number): number {
  const span = max - min;
  if (span < 10) return 2;
  if (span < 100) return 1;
  return 0;
}

/**
 * 按 parameterCode 生成确定性 mock 结果。
 *
 * - 未知 code（参数表查不到）→ 固定 fallback `{ jcz:'—', dw:'', jd:'合格' }`
 * - 有真技术要求：按 comparison 方向把哈希值映射到合规区间
 *   （≥ min → [min, min(推断上沿, min+50))；≤ max → [max-窗口, max]，窗口=min(max,50,max/2)）
 * - 无真技术要求：按参数名关键字推断区间，哈希均匀取值
 *
 * `requirement` 为调用方提供的判定依据文案（如 TestRecord.requirement），
 * 当前不影响数值（数值由 code 决定性驱动），预留给 assembleReport 显示用。
 */
export function mockResult(parameterCode: string, requirement?: string): MockResult {
  const name = NAME_BY_CODE.get(parameterCode);
  if (name === undefined) return { ...UNKNOWN_RESULT };

  const { req } = requirementFor(parameterCode);
  const dw = inferUnit(name);

  let value: number;
  let rangeMin: number;
  let rangeMax: number;
  if (req?.minValue != null && req.comparison === "≥") {
    // [min, upper)：upper 取推断区间上沿（如抗压强度 50）或 min+50 的较小者，
    // 保证 mock 既合规又不超出该参数的常识范围。
    const inferred = inferRange(name);
    rangeMin = req.minValue;
    rangeMax = Math.min(inferred.max, req.minValue + 50);
    if (rangeMax <= rangeMin) rangeMax = rangeMin + 1;
    value = rangeMin + ((hash(parameterCode) % 1000) / 1000) * (rangeMax - rangeMin);
  } else if (req?.maxValue != null && req.comparison === "≤") {
    // [max-窗口, max]：窗口=min(max, 50, max/2)，避免越过上限
    rangeMax = req.maxValue;
    const window = Math.min(50, req.maxValue / 2);
    value = req.maxValue - ((hash(parameterCode) % 1000) / 1000) * window;
    rangeMin = req.maxValue - window;
  } else {
    const r = inferRange(name);
    rangeMin = r.min;
    rangeMax = r.max;
    const span = r.max - r.min;
    value = r.min + ((hash(parameterCode) % 1000) / 1000) * span;
  }

  const d = decimals(rangeMin, rangeMax);
  // 引用 requirement 以保留参数语义（留给后续 assembleReport 使用）
  void requirement;
  return { jcz: value.toFixed(d), dw, jd: "合格" };
}
