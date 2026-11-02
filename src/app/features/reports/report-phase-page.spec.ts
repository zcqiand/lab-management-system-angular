// M03.F05/F06/F07/F08 报告 4 阶段 DOM 测试（REQ-2026-031 L-T4，移植自
// lab-management-system-react/tests/features/reports/reportPhasePage.dom.test.tsx，
// 真链路语义 1:1）。
//
// 4 页共享 ReportPhasePage 组件，按 flowStatus 过滤同型（GET /api/receipts?
// flowStatus=<stage>）。shared 种子每阶段固定 30 行。
// angular 形态：react render(<MemoryRouter><Page/>) → TestHost + navigateByUrl。
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { screen, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect, vi } from "vitest";

import { fnTest } from "../../../../tests/fn";
import {
  TestHostComponent,
  realChainProviders,
  settle,
} from "../../../../tests/helpers/ng-test";
import {
  installRealChain,
  renderedCommissionCodes,
  seedCommissionCodes,
} from "../../../../tests/helpers/real-chain";
import { ReportReviewPageComponent } from "../../pages/report-review-page";
import { ReportApprovePageComponent } from "../../pages/report-approve-page";
import { ReportIssuePageComponent } from "../../pages/report-issue-page";
import { ReportArchivePageComponent } from "../../pages/report-archive-page";

// react 同款放宽（45s 档）：真链路多 RTT，fnTest 无 options 通道 → 文件级。
vi.setConfig({ testTimeout: 90_000 });

type Phase = "review" | "approval" | "issuance" | "archived";

let fixture: ComponentFixture<TestHostComponent>;

/** 挂路由宿主并显式导航（TestBed 初始导航不确定）。 */
async function renderPage(path: string): Promise<ComponentFixture<TestHostComponent>> {
  window.history.replaceState({}, "", path);
  fixture = TestBed.createComponent(TestHostComponent);
  await TestBed.inject(Router).navigateByUrl(path);
  await settle(fixture);
  return fixture;
}

beforeEach(() => {
  localStorage.clear();
  installRealChain();
  TestBed.configureTestingModule({
    imports: [TestHostComponent],
    providers: realChainProviders([
      { path: "report-review", component: ReportReviewPageComponent },
      { path: "report-approve", component: ReportApprovePageComponent },
      { path: "report-issue", component: ReportIssuePageComponent },
      { path: "report-archive", component: ReportArchivePageComponent },
    ]),
  });
});

/** 列表非空 + 渲染编号 ⊆ 该阶段种子编号集（真库数据锚）。
 *  B6 加载态：整页 PageLoading 门控后，标题随数据一起出现 → waitFor 断言。 */
async function expectStageRendered(title: string, stage: Phase): Promise<void> {
  await waitFor(
    () => {
      fixture.detectChanges();
      expect(screen.getByText(title)).toBeTruthy();
      expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
    },
    { timeout: 60_000 },
  );
  const allowed = seedCommissionCodes(stage);
  const rendered = renderedCommissionCodes();
  expect(rendered.length).toBeGreaterThan(0);
  for (const code of rendered) expect(allowed.has(code)).toBe(true);
}

describe("M03.F05 报告审核", () => {
  fnTest(
    ["M03.F05.I01"],
    "报告审核：渲染标题 + 列表行（真库 review 阶段种子穿透）",
    async () => {
      await renderPage("/report-review");
      await expectStageRendered("报告审核", "review");
    },
  );

  fnTest(["M03.F05.I02"], "报告审核：「审核通过」按钮 data-fn 可见", async () => {
    await renderPage("/report-review");
    await waitFor(() => {
      fixture.detectChanges();
      expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
    });
    expect(screen.getByRole("button", { name: /审核通过/ })).toBeTruthy();
  });
});

describe("M03.F06 报告批准", () => {
  fnTest(
    ["M03.F06.I01"],
    "报告批准：渲染标题 + 列表行（真库 approval 阶段种子穿透）",
    async () => {
      await renderPage("/report-approve");
      await expectStageRendered("报告批准", "approval");
    },
  );

  fnTest(["M03.F06.I02"], "报告批准：「批准」按钮 data-fn 可见", async () => {
    await renderPage("/report-approve");
    await waitFor(() => {
      fixture.detectChanges();
      expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
    });
    expect(screen.getByRole("button", { name: /批准/ })).toBeTruthy();
  });
});

describe("M03.F07 报告发放", () => {
  fnTest(
    ["M03.F07.I01"],
    "报告发放：渲染标题 + 列表行（真库 issuance 阶段种子穿透）",
    async () => {
      await renderPage("/report-issue");
      await expectStageRendered("报告发放", "issuance");
    },
  );

  fnTest(["M03.F07.I02"], "报告发放：「发放」按钮 data-fn 可见", async () => {
    await renderPage("/report-issue");
    await waitFor(() => {
      fixture.detectChanges();
      expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
    });
    expect(screen.getByRole("button", { name: /发放/ })).toBeTruthy();
  });
});

describe("M03.F08 报告归档", () => {
  fnTest(
    ["M03.F08.I01"],
    "报告归档：渲染标题 + 列表行（真库 archived 阶段种子穿透）",
    async () => {
      await renderPage("/report-archive");
      await expectStageRendered("报告归档", "archived");
    },
  );

  fnTest(["M03.F08.I02"], "报告归档：「归档完成」按钮 data-fn 可见", async () => {
    await renderPage("/report-archive");
    await waitFor(() => {
      fixture.detectChanges();
      expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
    });
    expect(screen.getByRole("button", { name: /归档完成/ })).toBeTruthy();
  });
});
