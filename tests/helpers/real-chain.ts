// tests/helpers/real-chain.ts — 单测真链路基座（REQ-2026-031，移植自
// lab-management-system-react/tests/helpers/real-chain.ts + saas-angular 同名件）。
//
// msw 已全仓不存在（angular 骨架天生无 mock 层）：jsdom 请求同源直连真
// nextjs :5201（jsdom url 与 baseUrl 同源——跨源 XHR 被吞成网络错误，见
// vitest.bridge.config.ts）。本文件提供三件事：
//   1. `installRealChain()`：token 双通道（globalSetup provide("TEST_TOKEN") /
//      process.env，任一在即可）→ localStorage 契约 key 写回（AppComponent 的
//      hydrate 在 TestBed 单组件测试里不跑，AuthStoreService 由各 spec 用
//      testSetState 直驱 authenticated 态——react __testSetState 同款时序；
//      拦截器 Bearer 从 localStorage 契约 key 读，这里必须写）。
//   2. 真链路延迟预算：@testing-library/dom waitFor 统一 30s（远程 PG 多 RTT +
//      nextjs dev 惰性编译，lab-react 实测单条 list 1~2.5s、冷跑可到 ~17s）。
//   3. `SEED` 锚：lab-shared seeds/*.json（DB 快照权威源，globalSetup 每次跑前
//      upsert 灌库）。断言一律锚定种子行的固定 id/字段，不许断言易变业务值。
import { inject } from "vitest";
import { configure } from "@testing-library/dom";

// globalSetup 双通道之一：provide("TEST_TOKEN", token) 的消费类型声明
declare module "vitest" {
  interface ProvidedContext {
    TEST_TOKEN: string;
  }
}

import receiptsSeedJson from "../../../lab-management-system-shared/seeds/sample_receipts.json";
import contractsSeedJson from "../../../lab-management-system-shared/seeds/contracts.json";
import objectsSeedJson from "../../../lab-management-system-shared/seeds/inspection_objects.json";
import brandsSeedJson from "../../../lab-management-system-shared/seeds/inspection_brands.json";
import standardsSeedJson from "../../../lab-management-system-shared/seeds/inspection_standards.json";
import parametersSeedJson from "../../../lab-management-system-shared/seeds/inspection_parameters.json";
import standardParametersSeedJson from "../../../lab-management-system-shared/seeds/inspection_standard_parameters.json";
import reportNameParametersSeedJson from "../../../lab-management-system-shared/seeds/inspection_report_name_parameters.json";

import { TOKEN_STORAGE_KEYS } from "../../src/api/contracts";
import type { AuthState } from "../../src/api/contracts";
import type { AuthStoreService } from "../../src/state/auth-store.service";
import type { MyTenant } from "../../src/api/endpoints/model";

/**
 * 把当前测试文件切到真链路：
 *  - localStorage 契约 key 写回（afterEach 的 localStorage.clear() 之后重新写；
 *    angular 拦截器由 TestBed providers 每测试注入，Bearer 从 localStorage 读——
 *    没有 react axios 拦截器叠链问题）；
 *  - @testing-library/dom waitFor 预算放宽（真链路延迟见文件头）。
 *
 * 每个 it 前调（beforeEach）。
 */
export function installRealChain(): void {
  configure({ asyncUtilTimeout: 30_000 });
  const token = testToken();
  if (!token) throw new Error("fail-fast: TEST_TOKEN 缺失——globalSetup 未运行？");
  localStorage.setItem(TOKEN_STORAGE_KEYS.accessToken, token);
  localStorage.setItem(TOKEN_STORAGE_KEYS.refreshToken, token);
}

/**
 * 直驱 authenticated 态（react dom 测试 __testSetState + __testSetTenants 同款）：
 * 会话租户清单注入 store，再落 authenticated。tenant 由用例给定（fixture 租户，
 * 非生产兜底——ADR-0019 禁的是生产代码路径猜业务身份）。
 */
export function setAuthenticated(
  store: AuthStoreService,
  tenant: MyTenant,
  tenants: MyTenant[] = [tenant],
): void {
  store.testSetTenants(tenants);
  const state: AuthState = {
    kind: "authenticated",
    value: {
      kind: "authenticated",
      user: { id: "u1", username: "admin" },
      tenant,
      permissions: [],
      tokenExpiresAt: Date.now() + 60_000,
    },
  };
  store.testSetState(state);
}

/** token 双通道：process.env（forks pool 继承）优先，回落 vitest inject。 */
export function testToken(): string {
  const fromEnv = process.env["TEST_TOKEN"];
  if (fromEnv) return fromEnv;
  try {
    const injected: unknown = inject("TEST_TOKEN");
    return typeof injected === "string" ? injected : "";
  } catch {
    return "";
  }
}

// ————————————————————————————————————————————————
// SEED 锚（lab-shared seeds/*.json，snake_case 原样出库）
// ————————————————————————————————————————————————

export interface SeedReceiptRow {
  id: string;
  commission_code: string;
  flow_status: string;
  test_category: string;
}

export interface SeedContractRow {
  id: string;
  contract_code: string;
}

export const SEED = {
  receipts: receiptsSeedJson as unknown as SeedReceiptRow[],
  contracts: contractsSeedJson as unknown as SeedContractRow[],
  inspectionObjects: objectsSeedJson as unknown as Array<{
    code: string;
    name: string;
  }>,
  inspectionBrands: brandsSeedJson as unknown as Array<{
    code: string;
    inspection_object_code: string;
    name: string;
  }>,
  inspectionStandards: standardsSeedJson as unknown as Array<{
    code: string;
    name: string;
  }>,
  inspectionParameters: parametersSeedJson as unknown as Array<{
    code: string;
    name: string;
  }>,
  /** 标准↔参数关联（弹窗「已关联态」断言与 toggle 目标选取的种子锚） */
  inspectionStandardParameters: standardParametersSeedJson as unknown as Array<{
    inspection_standard_code: string;
    inspection_parameter_code: string;
  }>,
  /** 报告名称↔参数关联（报告名称关联弹窗 toggle 目标选取的种子锚） */
  inspectionReportNameParameters: reportNameParametersSeedJson as unknown as Array<{
    report_name_code: string;
    inspection_parameter_code: string;
  }>,
};

/** 某流程阶段的种子委托书编号集合（列表页「渲染行 ⊆ 该阶段种子行」断言用）。 */
export function seedCommissionCodes(flowStatus: string): Set<string> {
  return new Set(
    SEED.receipts
      .filter((r) => r.flow_status === flowStatus)
      .map((r) => r.commission_code),
  );
}

/** 委托书编号字面（WS-2026-Fxxxx / WS-TEST-…）。 */
export const COMMISSION_CODE_RE = /WS-\d{4}-[A-Z]+\d*/;

/** 从当前 DOM 的表格行里取已渲染的委托书编号（列表页第一列都是 Link/文本）。 */
export function renderedCommissionCodes(): string[] {
  return Array.from(document.querySelectorAll("table a, table td"))
    .map((el) => el.textContent ?? "")
    .filter((t) => COMMISSION_CODE_RE.test(t));
}

/** 种子层面某参数已关联的标准编码集合。 */
export function seedLinkedStandards(parameterCode: string): Set<string> {
  return new Set(
    SEED.inspectionStandardParameters
      .filter((l) => l.inspection_parameter_code === parameterCode)
      .map((l) => l.inspection_standard_code),
  );
}

/**
 * 某参数在种子层面**未**关联的首个标准编码（弹窗 toggle POST 用例的确定性目标）。
 * 运行前由测试的 beforeEach DELETE 兜底清场，保证真后端关联态与种子一致。
 */
export function firstUnlinkedStandardFor(parameterCode: string): string {
  const linked = seedLinkedStandards(parameterCode);
  const free = SEED.inspectionStandards
    .map((s) => s.code)
    .filter((c) => !linked.has(c))
    .sort()[0];
  if (!free) {
    throw new Error(`seed 锚失效：参数 ${parameterCode} 关联了全部标准`);
  }
  return free;
}

/**
 * 某报告名称在种子层面**未**关联的首个参数（弹窗 toggle POST 用例的确定性目标）。
 * 运行前由测试的 beforeEach DELETE 兜底清场，保证真后端关联态与种子一致。
 */
export function firstUnlinkedParameterFor(reportNameCode: string): string {
  const linked = new Set(
    SEED.inspectionReportNameParameters
      .filter((l) => l.report_name_code === reportNameCode)
      .map((l) => l.inspection_parameter_code),
  );
  const free = SEED.inspectionParameters
    .map((p) => p.code)
    .filter((c) => !linked.has(c))
    .sort()[0];
  if (!free) {
    throw new Error(`seed 锚失效：报告名称 ${reportNameCode} 关联了全部参数`);
  }
  return free;
}
