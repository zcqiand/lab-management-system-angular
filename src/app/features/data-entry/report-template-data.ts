import type { SampleReceipt } from "@/api/endpoints/model/sampleReceipt";
import type { Sample } from "@/api/endpoints/model/sample";
import type { TestRecord } from "@/api/endpoints/model/testRecord";
import generatedReportNameParameters from "@/data/generated/inspection-report-name-parameter.json";
import generatedReportNames from "@/data/generated/inspection-report-name.json";
import generatedParameters from "@/data/generated/inspection-parameter.json";
import { MANIFEST_BY_BASENAME as MANIFESTS_RAW } from "@/data/templates/manifests";
import {
  mockResult,
  requirementByZoneAndSieve,
  requirementFor,
  requirementsByGrade,
} from "./report-template-seed";

/** RN → fullName 映射（报告标题占位符 {bgmc} 替换来源）。 */
const REPORT_FULL_NAME: Map<string, string> = new Map(
  (generatedReportNames as Array<{ code: string; fullName: string }>).map((r) => [
    r.code,
    r.fullName,
  ]),
);

/**
 * 机构信息（M01.F01）——报告模板表头的检测单位信息。
 * GAP（TypeSpec SSOT Phase B2+C1）：shared 契约无 org-info 端点/模型（后端
 * /api/org-info 路由已家族级移除），无 orval 模型可引；此类型仅是报告填充层的
 * 视图输入（调用方现传 null，模板里机构字段留空），保留在本文件局部，等契约
 * 补端点后迁到 model。
 */
export interface OrgInfo {
  orgName: string;
  registeredAddress: string;
  testingSiteAddress: string;
  postalCode: string;
  contactPhone: string;
  email: string;
  qualificationCertNo: string;
  updatedAt: string;
}

/**
 * 105_混凝土抗压强度检测报告.docx 的填充数据。
 *
 * 占位符清单与数据来源见 docs/conventions/report-template-105.md。
 * 每个字段名即 docxtemplater 模板里的 {tag}；表格用 {#rows}…{/rows} 行循环，
 * 数据层固定补齐到 15 行（不足留空），保证套打时表格行位稳定。
 */

/** 检测数据表的一行 = 一个样品。
 *  模板物理结构：TABLE#0 共 5 个 vMerge 段（r1/r4/r7/r10/r13），每段 3 行高；每段放 1 个样品。
 *  ybbh 等 9 列在段内 3 行合并显示（vMerge restart+continue，顶部 cell 内容覆盖整段）；
 *  kyqd 列每段 3 个独立 cell（无 vMerge），分别为 kyqd0/kyqd1/kyqd2 → 3 个试件强度，
 *  docx 段内 3 行高正好容纳 3 个独立 cell 各显示 1 行（套打对齐）。
 *  5 段 → 最多 5 个样品；padRows 补齐到 15 行。 */
export interface SpecimenRow {
  ybbh: string; // 样品编号
  gcbw: string; // 工程部位
  sjdj: string; // 设计等级（混凝土取 model，如 C30）
  gccm: string; // 公称尺寸 长×宽×高（mm）
  cxrq: string; // 成型日期
  jcrq: string; // 检测日期
  lq: string; // 龄期（d）
  yhtj: string; // 养护条件
  kyqd0: string; // 抗压强度（MPa）——试件 1（独立 cell）
  kyqd1: string; // 抗压强度（MPa）——试件 2（独立 cell）
  kyqd2: string; // 抗压强度（MPa）——试件 3（独立 cell）
  /** 抗压强度（MPa）——三试件合并到 1 个 cell，\n 分行（docxtemplater linebreaks:true）。
   *  108_砂浆抗压强度检测报告 的 {#rows} 循环用单列 {kyqd}，不像 105 拆成 3 个独立 cell；
   *  两份模板共用 SpecimenRow，故同时提供 kyqd0/1/2 与合并版 kyqd。 */
  kyqd: string;
  dbz: string; // 抗压强度代表值（MPa）——该样品的代表值（3 试件均值）
}

export interface ConcreteReportData {
  // —— 报告标题 ——
  jgmc: string; // 检验检测机构名称（org.orgName，整行）
  bgmc: string; // 报告名称（RN 对应的 fullName，模板标题段占位符）
  // —— 表头 / 基本信息 ——
  wtdw: string; // 委托单位
  bgbh: string; // 报告编号
  gcmc: string; // 工程名称
  sgdw: string; // 施工单位
  sylr: string; // 收样日期
  jzdw: string; // 见证单位
  jzr: string; // 见证人
  ypms: string; // 样品描述
  sccj: string; // 生产厂家/商标
  jcyj: string; // 检测依据
  jcbl: string; // 检测类别
  zysb: string; // 主要设备
  jcdz: string; // 检测地址
  yply: string; // 样品来源
  jchj: string; // 检测环境（receipt.testEnvironment）
  pz: string; // 批准人（待补：OrgInfo 暂无人员字段）
  sh: string; // 审核人（待补）
  jc: string; // 检测人
  qfrq: string; // 签发日期
  // —— 检测单位基本信息（取自 OrgInfo 单例）——
  zcdz: string; // 注册地址
  jcnlcdz: string; // 检测能力场所地址
  yzbm: string; // 邮政编码
  lxdh: string; // 联系电话
  dzxx: string; // 电子信箱
  zzszsbh: string; // 资质证书编号
  // —— 检测数据表（每行一个试件，固定 15 行）——
  rows: SpecimenRow[];
  // —— 表尾 ——
  jcl: string; // 检测结论
  bz: string; // 备注
}

/** 表格固定行数：与预印表单一致，套打对齐用。 */
export const CONCRETE_TABLE_ROW_COUNT = 15;

const EMPTY_ROW: SpecimenRow = {
  ybbh: "",
  gcbw: "",
  sjdj: "",
  gccm: "",
  cxrq: "",
  jcrq: "",
  lq: "",
  yhtj: "",
  kyqd0: "",
  kyqd1: "",
  kyqd2: "",
  kyqd: "",
  dbz: "",
};

function padRows(rows: SpecimenRow[]): SpecimenRow[] {
  const out = rows.slice(0, CONCRETE_TABLE_ROW_COUNT);
  while (out.length < CONCRETE_TABLE_ROW_COUNT) out.push({ ...EMPTY_ROW });
  return out;
}

// —— 表头对齐：9pt 宋体下整行约 49 个汉字宽（与下方表格对齐）。
// 显示宽度按 CJK/全角=2、ASCII=1 计；不足时补全角空格，使两字段行的第二标签列对齐、整行填满表格宽度。
const LINE_DISPLAY_WIDTH = 98; // 整行（与表格同宽）
const LABEL_DISPLAY_WIDTH = 10; // 「委托单位：」5 汉字
const FIRST_VALUE_WIDTH = 38; // 两字段行第一个值的列宽（决定第二标签对齐位置）
const SECOND_VALUE_WIDTH =
  LINE_DISPLAY_WIDTH - LABEL_DISPLAY_WIDTH * 2 - FIRST_VALUE_WIDTH; // = 40
const SINGLE_VALUE_WIDTH = LINE_DISPLAY_WIDTH - LABEL_DISPLAY_WIDTH; // 单字段行（工程名称）= 88

/** CJK/全角=2、ASCII=1 的显示宽度。 */
function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    w += /[\u3000-鿿＀-￯\u2000-⁯]/.test(ch) ? 2 : 1;
  }
  return w;
}

/** 用全角空格把 s 补到 target 显示宽度（不足才补，超出原样返回）。 */
function padLine(s: string, target: number): string {
  const need = target - displayWidth(s);
  if (need <= 0) return s;
  return s + "\u3000".repeat(Math.floor(need / 2)) + (need % 2 ? " " : "");
}

/** IP-0055 = 抗压强度检测参数（混凝土）。 */
const CONCRECE_STRENGTH_PARAM = "IP-0055";

interface AssembleInput {
  receipt: SampleReceipt;
  samples: Sample[];
  records: TestRecord[];
  org: OrgInfo | null;
}

/** IP-0055 test record.result 解析后的形状（见 ConcreteCompressCard.emit 的 JSON）。
 *  解析失败/为空 → falls back to 把 raw 视为单值字符串。 */
interface ConcreteCompressJson {
  loads: number[];
  strengths: (number | null)[];
  representative?: number;
}

function parseConcreteCompressJson(raw: string | undefined): ConcreteCompressJson | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const obj = JSON.parse(trimmed) as Partial<ConcreteCompressJson>;
    if (!obj || !Array.isArray(obj.loads) || !Array.isArray(obj.strengths)) return null;
    return {
      loads: obj.loads.map((v) => (typeof v === "number" ? v : Number(v) || 0)),
      strengths: obj.strengths,
      representative:
        typeof obj.representative === "number" ? obj.representative : undefined,
    };
  } catch {
    return null;
  }
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  return String(Math.round(n * 100) / 100);
}

/** 把接样单/样品/检测记录/机构信息拼成模板填充数据。
 *  1 个样品 → 1 个 SpecimenRow → 占 1 个 vMerge 段（每段 3 行高）。
 *  ybbh 等 9 列在该段内 3 行合并显示；kyqd 列单元格内 \n 拼 3 个试件强度，
 *  docxtemplater linebreaks:true 把 \n 渲染成单元格内 3 行（每段视觉 3 行）。
 *  5 段 → 最多 5 个样品；padRows 补齐到 15 行（兼容原设计，剩余 10 行是 5 段的 continue cell，
 *  视觉上被顶部 cell 内容覆盖——不增加实际样品数）。 */
export function assembleConcreteReport(input: AssembleInput): ConcreteReportData {
  const { receipt, samples, records, org } = input;

  const rows: SpecimenRow[] = samples.map((s) => {
    const rec = records.find(
      (r) => r.sampleId === s.id && r.parameterCode === CONCRECE_STRENGTH_PARAM,
    );
    const parsed = parseConcreteCompressJson(rec?.result);
    // 3 个试件强度各填 1 个独立字段（docx 段内 3 个独立 cell 各 1 值，套打对齐）
    const ks = parsed?.strengths ?? [];
    const fallback = rec?.result ?? "";
    return {
      ybbh: s.sampleCode ?? "",
      gcbw: s.structuralPart ?? "",
      // 混凝土设计等级即强度等级（如 C30），落在 model；接头/砂石的等级在 grade。
      sjdj: s.model || s.grade || "",
      gccm: s.specification ?? "",
      cxrq: s.arrivalDate ?? "",
      jcrq: receipt.testEndDate ?? "",
      lq: s.age ?? "",
      yhtj: s.curingCondition ?? "",
      kyqd0: ks[0] !== undefined ? fmtNum(ks[0]) : fallback,
      kyqd1: ks[1] !== undefined ? fmtNum(ks[1]) : fallback,
      kyqd2: ks[2] !== undefined ? fmtNum(ks[2]) : fallback,
      // 合并列：有解析结果就把各试件强度按行拼进同一 cell，否则回退原始结果串
      kyqd: ks.length > 0 ? ks.map((v) => fmtNum(v)).join("\n") : fallback,
      // dbz 单值：代表值（3 个强度均值）；老 result 字符串或空 → 回退原样
      dbz: parsed ? fmtNum(parsed.representative) : fallback,
    };
  });

  const firstSample = samples[0];

  return {
    jgmc: org?.orgName ?? "",
    bgmc: REPORT_FULL_NAME.get(receipt.categoryCode) ?? "",
    // 两字段行：第一值补到 FIRST_VALUE_WIDTH（使第二标签列对齐），第二值补到 SECOND_VALUE_WIDTH（填满表格行宽）
    wtdw: padLine(receipt.clientUnit ?? "", FIRST_VALUE_WIDTH),
    bgbh: padLine(receipt.reportCode ?? "", SECOND_VALUE_WIDTH),
    gcmc: padLine(receipt.projectName ?? "", SINGLE_VALUE_WIDTH),
    sgdw: padLine(receipt.constructionUnit ?? "", FIRST_VALUE_WIDTH),
    sylr: padLine(receipt.commissionDate ?? "", SECOND_VALUE_WIDTH),
    jzdw: padLine(receipt.witnessUnit ?? "", FIRST_VALUE_WIDTH),
    jzr: padLine(receipt.witness ?? "", SECOND_VALUE_WIDTH),
    ypms: padLine(
      firstSample?.remark || firstSample?.sampleName || "",
      FIRST_VALUE_WIDTH,
    ),
    sccj: padLine(firstSample?.manufacturer ?? "", SECOND_VALUE_WIDTH),
    jcyj: padLine((receipt.testingBasis ?? []).join("、"), FIRST_VALUE_WIDTH),
    jcbl: padLine(receipt.testCategory ?? "", SECOND_VALUE_WIDTH),
    zysb: padLine(receipt.mainEquipment ?? "", FIRST_VALUE_WIDTH),
    jcdz: padLine(org?.testingSiteAddress ?? "", SECOND_VALUE_WIDTH),
    yply: padLine(receipt.sampleSource ?? "", FIRST_VALUE_WIDTH),
    jchj: padLine(receipt.testEnvironment ?? "", SECOND_VALUE_WIDTH),
    pz: "",
    sh: "",
    jc: receipt.testOperator ?? "",
    qfrq: receipt.reportDate ?? "",
    zcdz: org?.registeredAddress ?? "",
    jcnlcdz: org?.testingSiteAddress ?? "",
    yzbm: org?.postalCode ?? "",
    lxdh: org?.contactPhone ?? "",
    dzxx: org?.email ?? "",
    zzszsbh: org?.qualificationCertNo ?? "",
    rows: padRows(rows),
    jcl: receipt.conclusion ?? "",
    bz: receipt.remark ?? "",
  };
}

// —— 通用 assembleReport：参数轴 + 试件轴 ——

const RN_PARAMS = generatedReportNameParameters as Array<{
  reportNameCode: string;
  inspectionParameterCode: string;
}>;
const PARAMETERS = generatedParameters as Array<{ code: string; name: string }>;
const PARAM_NAME = new Map(PARAMETERS.map((p) => [p.code, p.name]));

/** 参数轴结果表一行。 */
export interface ParameterItem {
  xh: string; // 序号
  mc: string; // 项目名称
  jz: string; // 检测值/技术指标（要求）——单列模板用
  /** 技术要求分类列（Ⅰ类/Ⅱ类/Ⅲ类），砂石类报告的 {pN_jz1..3} 用 */
  jzByGrade: string[];
  jcz: string; // 检测值
  dw: string; // 单位
  jd: string; // 判定
  jcyj: string; // 检测依据/标准（per-row，为空表示无 per-param 检测标准）
  /** 每个试件的单个强度值（强度类参数：抗折 3 个 / 抗压 6 个），来自 TestRecord.result JSON。 */
  strengths?: number[];
}

/** 通用表头字段（= ConcreteReportData 去 rows）。 */
export type CommonReportFields = Omit<ConcreteReportData, "rows">;
export type ParameterAxisData = CommonReportFields & { items: ParameterItem[] };
export type SpecimenAxisData = CommonReportFields & { rows: SpecimenRow[] };

/** 走试件轴的报告编号（沿用 105 的 10 列试件表）。 */
const SPECIMEN_AXIS_RN = new Set(["RN-105-1", "RN-108-2"]);

export function reportAxis(reportNameCode: string): "parameter" | "specimen" {
  return SPECIMEN_AXIS_RN.has(reportNameCode) ? "specimen" : "parameter";
}

/** 构建 27 个通用表头字段（复用 105 现有映射逻辑，DRY）。 */
function buildCommon(input: AssembleInput): CommonReportFields {
  // 试件轴的 rows 由 assembleReport 单独处理，这里剥离以保留 27 个通用表头字段。
  const { rows: _rows, ...common } = assembleConcreteReport(input);
  void _rows;
  return common;
}

/**
 * 报告结果单元格展示值：
 * - 计算型卡片（水泥抗折/抗压、混凝土抗压）把结果存成 JSON（{loads,strengths,mean|representative}），
 *   报告参数轴需展示其代表值(mean/representative)而非整段 JSON。
 * - 普通纯文本结果原样返回；空/未录入返回 undefined 交由 mock 回退。
 */
function pickResultDisplay(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (raw.trimStart().startsWith("{")) {
    try {
      const o = JSON.parse(raw) as { mean?: number; representative?: number };
      const v = o.mean ?? o.representative;
      if (typeof v === "number") return String(v);
    } catch {
      // 非法 JSON → 原样返回
    }
  }
  return raw;
}

/** 从强度类 TestRecord.result（{loads,strengths,...} JSON）解析单个强度值数组；非强度结果返回 undefined。 */
function parseStrengthsFromResult(raw: string | undefined): number[] | undefined {
  if (!raw || !raw.trimStart().startsWith("{")) return undefined;
  try {
    const o = JSON.parse(raw) as { strengths?: unknown };
    return Array.isArray(o.strengths) ? (o.strengths as number[]) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 通用报告组装：按报告编号轴分发。
 * - 试件轴（RN-105-1/RN-108-2）：返回完整 ConcreteReportData（含 rows，固定 15 行）。
 * - 参数轴（其余）：按 RN→参数 关联组装 items，无 TestRecord 时用 mockResult 回退。
 */
export function assembleReport(
  input: AssembleInput,
): ParameterAxisData | SpecimenAxisData {
  const common = buildCommon(input);
  const { receipt, records } = input;

  if (reportAxis(receipt.categoryCode) === "specimen") {
    return { ...common, rows: assembleConcreteReport(input).rows };
  }

  // 参数轴：按 RN→参数 关联组装 items
  const paramCodes = RN_PARAMS.filter(
    (l) => l.reportNameCode === receipt.categoryCode,
  ).map((l) => l.inspectionParameterCode);

  const items: ParameterItem[] = paramCodes.map((pc, i) => {
    const rec = records.find((r) => r.parameterCode === pc);
    const m = mockResult(pc, rec?.requirement);
    const req = requirementFor(pc);
    return {
      xh: String(i + 1),
      mc: PARAM_NAME.get(pc) ?? pc,
      jz: rec?.requirement ?? req.jz,
      jzByGrade: requirementsByGrade(pc),
      jcz: pickResultDisplay(rec?.result) ?? m.jcz,
      dw: m.dw,
      jd: rec?.verdict ?? m.jd,
      // per-row 检测依据 = 该参数记录选定的检测标准；无则留空（—）。
      // 不再用技术要求文案（requirementFor.jz）兜底——那是「技术要求」列，不是「检测依据」。
      jcyj: rec?.standardCode ?? "",
      // 强度类参数：解析 result JSON 里的单个强度值数组（供模板 {qd*_0..N} 单格填充）。
      strengths: parseStrengthsFromResult(rec?.result),
    };
  });

  return { ...common, items };
}

// —— grid manifest 扁平化（Strategy A，2026-07-24）——
//
// 30 份报告模板都是「整页布局大表」：单张表含合并单元格，表头与结果数据同表，
// 结果表行是各类别固定的检测项（如水泥的"细度/凝结时间/强度块"），与 RN→参数
// 关联数据（噪声大、含跨类别无关参数）无法自动对齐。因此 loop-mode 的 {#items}
// 行循环不适用，改用 grid-mode：每份模板配 data/templates/<basename>.inject.json
// sidecar，声明每个待填单元格 (table,row,col,tag) 的值来源 source。
//
// sidecar 同时是两端的单一事实源：
//   - Python inject_placeholders.inject_grid：按 (table,row,col) 把 {tag} 写入单元格
//     （只用 tag/坐标，忽略 source）。
//   - 本模块 flattenForDocx：按 source 把结构化数据解析成 {tag: value} 扁平字典，
//     供 docxtemplater 逐格填充。
//
// source 短语（冒号分隔）：
//   common.<field>  取 27 个通用表头字段之一（wtdw/bgbh/.../jcl/bz）
//   param:<code>:<field>  取该参数的 TestRecord 值，无记录则 mockResult 回退；
//                         field ∈ mc/jz/jcz/dw/jd/jcyj
//   param:<code>:<grade>:<sieve>  按「级配区 × 筛孔」取技术要求 min~max 区间
//                                 （GB/T 14684-2022 表 3 等二维限值专用，颗粒级配 18 cell）
//   sample.<field>  取首个样品字段（sampleCode/sampleName/model/...）
//   ext:<key>       取首个样品 ext[key]（类别级扩展属性，由 SampleExtFieldsModal 录入）
//   static:<text>   字面量
//   mock:<key>      确定性 mock 数值（强度块单值/缺失参数占位用）

interface GridManifestCell {
  table: number;
  row: number;
  col: number;
  tag: string;
  source?: string;
}
interface GridManifest {
  mode: "grid";
  reportNameCode?: string;
  cells: GridManifestCell[];
}

// Next.js 无 import.meta.glob：本仓由 scripts/gen-template-index.mjs 预生成 manifests.ts
// （basename → inject manifest），等价 REF 的 eager glob 产物。
const MANIFEST_BY_BASENAME = MANIFESTS_RAW as Record<string, GridManifest>;

/** 是否存在该模板的 grid manifest（loop/specimen 模板无 manifest，走原结构化对象）。 */
export function hasGridManifest(templateBasename: string | null): boolean {
  return !!templateBasename && templateBasename in MANIFEST_BY_BASENAME;
}

/** 稳定哈希（非随机）：mock:<key> 用，保证同 key 同输出。 */
function hashKey(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function mockField(code: string, field: string): string {
  const m = mockResult(code);
  switch (field) {
    case "jcz":
      return m.jcz;
    case "dw":
      return m.dw;
    case "jd":
      return m.jd;
    case "jz":
      return requirementFor(code).jz;
    case "jcyj":
      // 检测依据非技术要求：mock 无 per-param 检测标准 → 留空（—）。
      return "";
    case "mc":
      return PARAM_NAME.get(code) ?? code;
    default:
      return "";
  }
}

/** mock:<key> → 确定性百分比样数值（强度单值/缺失参数占位）。 */
function mockValue(key: string): string {
  const h = hashKey(key);
  // 落在 1.0–50.0 之间，一位小数；形似合理即可
  return ((h % 490) / 10 + 1).toFixed(1);
}

function resolveSource(
  src: string,
  common: CommonReportFields,
  itemByCode: Map<string, ParameterItem>,
  samples: Sample[],
  rows?: SpecimenRow[],
  records?: TestRecord[],
): string {
  if (src.startsWith("common.")) {
    // 27 个通用表头字段是 105 段落布局专用、被 padLine 填充到 38-88 显示宽度。
    // grid 模板把它们放进表格 cell / 101 式段落，填充会撑爆列宽/行宽 → 整表变形。
    // padLine 只追加尾部全角/半角空格，strip 尾部空白即恢复原始值。
    const raw = String((common as Record<string, string>)[src.slice(7)] ?? "");
    return raw.replace(/[\s\u3000]+$/u, "");
  }
  if (src.startsWith("param:")) {
    const parts = src.split(":"); // ['param', code, field] 或 ['param', code, grade, sieve]
    const code = parts[1] ?? "";
    // param:<code>:<grade>:<sieve> —— 二维限值（颗粒级配 GB/T 14684-2022 表 3），
    // 优先于 jzN/sN/jcyj 等一维字段检测（parts.length === 4 才进）。
    if (parts.length >= 4) {
      const grade = parts[2] ?? "";
      const sieve = parts[3] ?? "";
      return requirementByZoneAndSieve(code, grade, sieve) ?? "";
    }
    const field = parts[2] ?? "";
    const it = itemByCode.get(code);
    // field = sN → 单个强度值（第 N 个试件）；无记录/无该试件则空。
    // field = jzN → 技术要求第 N 个分类列（jz1=Ⅰ类, jz2=Ⅱ类, jz3=Ⅲ类）
    const jzMatch = /^jz(\d+)$/.exec(field);
    if (jzMatch) {
      const idx = Number(jzMatch[1]) - 1;
      if (it) return it.jzByGrade?.[idx] ?? "";
      return requirementsByGrade(code)[idx] ?? "";
    }
    const sMatch = /^s(\d+)$/.exec(field);
    if (sMatch) {
      const v = it?.strengths?.[Number(sMatch[1])];
      return v === undefined || v === null ? "" : String(v);
    }
    if (it) return String((it as unknown as Record<string, string>)[field] ?? "");
    return mockField(code, field);
  }
  if (src.startsWith("sample.")) {
    const f = src.slice(7);
    return String(
      (samples[0] as unknown as Record<string, string> | undefined)?.[f] ?? "",
    );
  }
  // sample:<n>:<field> —— 第 n 个样品的字段（n 从 0 起）。
  // `sample.<field>` 只能取首个样品；抗渗一类「一份报告 = 多个样品块」的模板
  // （s1_/s2_/s3_ 三段）必须能按样品序号定位，否则 2、3 段永远渲染首样品。
  if (src.startsWith("sample:")) {
    const parts = src.split(":"); // ['sample', index, field]
    const idx = Number(parts[1] ?? "-1");
    const field = parts[2] ?? "";
    const s = samples[idx];
    return s ? String((s as unknown as Record<string, string>)[field] ?? "") : "";
  }
  // ext:<key> —— 类别级扩展属性（Sample.ext[ key ]）；manifest 把无法自动取数的格子
  // 改成 `ext:<key>` 后，预览前的 SampleExtFieldsModal 弹窗让用户补录，存到 samples[0].ext。
  if (src.startsWith("ext:")) {
    const key = src.slice(4);
    const ext = (samples[0] as unknown as { ext?: Record<string, string> } | undefined)
      ?.ext;
    return String(ext?.[key] ?? "");
  }
  // row:N:field —— 试件轴 grid 模板按行号取 structured.rows[N][field]（按 105 抗压 grid 模式）
  if (src.startsWith("row:")) {
    const parts = src.split(":"); // ['row', index, field]
    const idx = Number(parts[1] ?? "-1");
    const field = parts[2] ?? "";
    const r = rows?.[idx];
    return r ? String((r as unknown as Record<string, string>)[field] ?? "") : "";
  }
  // record:<code>:<jsonPath> —— 从 TestRecord.result JSON 解析任意字段；
  // 路径语法：a.b.c[0].d（点号属性 + 方括号下标），供「卡存多试件 JSON，模板按试件×次试验取数」用。
  if (src.startsWith("record:")) {
    const parts = src.split(":"); // ['record', code, path]
    const code = parts[1] ?? "";
    const path = parts.slice(2).join(":"); // path 可含冒号外的字符；通常不带 ':'
    const rec = records?.find((r) => r.parameterCode === code);
    if (!rec?.result) return "";
    try {
      const obj = JSON.parse(rec.result) as unknown;
      const v = walkJsonPath(obj, path);
      return v === undefined || v === null ? "" : String(v);
    } catch {
      return "";
    }
  }
  // srecord:<sampleIndex>:<code>:<jsonPath> —— 按样品序号取该样品的 TestRecord.result JSON。
  // `record:` 用 records.find(parameterCode) 只命中第一条记录，跨样品时全部落到首样品；
  // 抗渗（RN-105-2）等多样品分块模板需要逐样品取数。
  if (src.startsWith("srecord:")) {
    const parts = src.split(":"); // ['srecord', index, code, path]
    const idx = Number(parts[1] ?? "-1");
    const code = parts[2] ?? "";
    const path = parts.slice(3).join(":");
    const sid = samples[idx]?.id;
    if (!sid) return "";
    const rec = records?.find((r) => r.sampleId === sid && r.parameterCode === code);
    if (!rec?.result) return "";
    try {
      const v = walkJsonPath(JSON.parse(rec.result) as unknown, path);
      return v === undefined || v === null ? "" : String(v);
    } catch {
      return "";
    }
  }
  if (src.startsWith("static:")) return src.slice(7);
  if (src.startsWith("mock:")) return mockValue(src.slice(5));
  return "";
}

/** 简易 JSON 路径解析：支持 a / a.b / a[0] / a.b[2].c；不支持引号键。越界/类型错返回 undefined。 */
function walkJsonPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  // 切分：先按 [N] 拆段，再按 . 拆段；段序保持
  const segments: Array<string | number> = [];
  const re = /([^.[\]]+)|\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) {
    if (m[1] !== undefined) segments.push(m[1]);
    else if (m[2] !== undefined) segments.push(Number(m[2]));
  }
  let cur: unknown = obj;
  for (const seg of segments) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof seg === "number") {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[seg];
    } else {
      if (typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[seg];
    }
  }
  return cur;
}

/**
 * 把 assembleReport 的结构化数据扁平化成 docxtemplater 可直接渲染的 {tag: value}。
 *
 * - grid 模板（有 manifest）：按 manifest 的 source 解析每个 cell tag，合并 27 个
 *   通用表头字段（供段落 {wtdw} 等使用）+ 样品摘要字段 {ypbh/ypmc/gcbw/gccm}。
 * - loop/specimen 模板（无 manifest）：原样返回结构化对象（保留 items/rows）。
 */
export function flattenForDocx(
  categoryCode: string,
  templateBasename: string | null,
  structured: ParameterAxisData | SpecimenAxisData,
  samples: Sample[],
  records: TestRecord[] = [],
  options?: { extraCells?: GridManifestCell[] },
): Record<string, unknown> {
  const manifest = templateBasename ? MANIFEST_BY_BASENAME[templateBasename] : undefined;
  // loop/specimen 路径（如 105）：无 manifest，结构化对象直接交 docxtemplater
  if (!manifest) return structured as unknown as Record<string, unknown>;

  const items = "items" in structured ? structured.items : [];
  const rowsArr = "rows" in structured ? structured.rows : [];
  const {
    items: _dropItems,
    rows: _dropRows,
    ...common
  } = structured as ParameterAxisData & SpecimenAxisData;
  void _dropItems;
  void _dropRows;

  // code → item：assembleReport 按 RN_PARAMS 顺序构建 items，这里同序对齐
  const paramCodes = RN_PARAMS.filter((l) => l.reportNameCode === categoryCode).map(
    (l) => l.inspectionParameterCode,
  );
  const itemByCode = new Map<string, ParameterItem>();
  paramCodes.forEach((pc, i) => {
    if (items[i]) itemByCode.set(pc, items[i]);
  });

  // 通用表头字段（段落 {wtdw} 等）：grid 模板里这些进的是 101 式段落/表格，不是 105 的
  // 整行布局，padLine 填充会撑变形 → strip 尾部填充恢复原始值。
  const flat: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(common)) {
    flat[k] = String(v).replace(/[\s\u3000]+$/u, "");
  }
  // 样品摘要（表头里样品编号/名称/工程部位/规格等单元格引用）
  const s0 = samples[0];
  // noPropertyAccessFromIndexSignature（angular 侧比 react 严）：索引签名走方括号。
  flat["ypbh"] = s0?.sampleCode ?? "";
  flat["ypmc"] = s0?.sampleName ?? "";
  flat["gcbw"] = s0?.structuralPart ?? "";
  flat["gccm"] = s0?.specification ?? "";

  const allCells = options?.extraCells
    ? [...manifest.cells, ...options.extraCells]
    : manifest.cells;
  for (const cell of allCells) {
    const v = cell.source
      ? resolveSource(cell.source, common, itemByCode, samples, rowsArr, records)
      : "";
    // 空 source 也写入空串，确保 docxtemplater 不报未定义 tag
    flat[cell.tag] = v;
  }
  // 报告预览约定：任何占位符内容为空 → 一律打印「—」（适用所有 tag）。
  for (const k of Object.keys(flat)) {
    const v = flat[k];
    if (typeof v === "string" && v.trim() === "") flat[k] = "—";
  }
  return flat;
}

/**
 * 兜底集合：把 docx XML 里所有出现的 `{tag}` 也写进 flat dict，
 * 使未在 manifest 显式登记的占位符也渲染成「—」而不是 docxtemplater 默认的 "undefined"。
 *
 * 调用方在 document.xml 文本就绪后用：
 *   const ensured = ensureAllDocxTags(flat, documentXmlText);
 */
export function ensureAllDocxTags(
  flat: Record<string, unknown>,
  documentXml: string,
): Record<string, unknown> {
  if (!documentXml) return flat;
  const re = /\{([a-z_][a-zA-Z0-9_]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(documentXml)) !== null) {
    const tag = m[1];
    if (tag && !(tag in flat)) flat[tag] = "—";
  }
  return flat;
}

/**
 * 直接从 docx ArrayBuffer 抽取 document.xml 文本，扫描 `{tag}` 出现位置；
 * 把未在 flat 字典里登记的 tag 补成 '—'，避免 docxtemplater 默认打印 "undefined"。
 *
 * 这是 grid manifest 漏登记时的安全网。manifest 完备 → 此函数无副作用。
 */
export async function ensureAllDocxTagsFromBuffer(
  flat: Record<string, unknown>,
  docxBuffer: ArrayBuffer,
): Promise<Record<string, unknown>> {
  try {
    const PizZip = (await import("pizzip")).default;
    const zip = new PizZip(docxBuffer);
    const xml: string =
      zip.file("word/document.xml")?.asText() ??
      zip.file("word/document2.xml")?.asText() ??
      "";
    return ensureAllDocxTags(flat, xml);
  } catch {
    return flat;
  }
}

/**
 * 单 tag 解析 helper：给 UI 在补录弹窗外预览某 tag 当前会取到的值（不打 `—` 兜底）。
 * 解析失败返回 ''。
 */
export function resolveSourceByTag(
  source: string,
  ctx: {
    samples: Sample[];
    receipt: SampleReceipt;
    records: TestRecord[];
    org: OrgInfo | null;
  },
): string {
  const structured = assembleReport(ctx);
  const items = "items" in structured ? structured.items : [];
  const rowsArr = "rows" in structured ? structured.rows : [];
  const {
    items: _dropItems,
    rows: _dropRows,
    ...common
  } = structured as ParameterAxisData & SpecimenAxisData;
  void _dropItems;
  void _dropRows;
  const categoryCode = ctx.receipt.categoryCode;
  const paramCodes = RN_PARAMS.filter((l) => l.reportNameCode === categoryCode).map(
    (l) => l.inspectionParameterCode,
  );
  const itemByCode = new Map<string, ParameterItem>();
  paramCodes.forEach((pc, i) => {
    if (items[i]) itemByCode.set(pc, items[i]);
  });
  const resolved = resolveSource(
    source,
    common,
    itemByCode,
    ctx.samples,
    rowsArr,
    ctx.records,
  );
  return resolved.trim() === "" ? "" : resolved;
}
