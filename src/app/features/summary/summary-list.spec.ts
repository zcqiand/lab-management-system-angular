// M05 报告汇总 + 仪表盘统计 DOM 测试（REQ-2026-031 L-T4，移植自
// lab-management-system-react/tests/features/summary/summaryList.dom.test.tsx，
// 真链路语义 1:1）。
//
// GET /api/summary 与 /api/summary/stats 直连真后端 :5201（lab_dev 种子同源）。
// 断言锚：表头列标签 + 委托编号形状 + 统计卡字段；不锚易变的计数值。
// angular 形态：react render(<SummaryList/>) 裸挂 → TestBed.createComponent。
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { screen, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect, vi } from "vitest";

import { fnTest } from "../../../../tests/fn";
import { realChainHttpProviders } from "../../../../tests/helpers/ng-test";
import {
  installRealChain,
  renderedCommissionCodes,
  COMMISSION_CODE_RE,
} from "../../../../tests/helpers/real-chain";
import { SummaryListComponent } from "./summary-list";

// react 同款放宽（45s 档）：真链路多 RTT，fnTest 无 options 通道 → 文件级。
vi.setConfig({ testTimeout: 90_000 });

let fixture: ComponentFixture<SummaryListComponent>;

function renderList(): ComponentFixture<SummaryListComponent> {
  fixture = TestBed.createComponent(SummaryListComponent);
  fixture.detectChanges();
  return fixture;
}

beforeEach(() => {
  localStorage.clear();
  installRealChain();
  TestBed.configureTestingModule({
    // 直挂页组件（不走路由）→ 纯 HTTP 面 provider 组装（provideHttpClient +
    // apiBaseUrl/auth/unauthorized 拦截器链）。只给 zoneless 会把 GET 打到
    // jsdom about:blank → 汇总/stats 恒空（L-T4 首跑实锤）。
    providers: realChainHttpProviders(),
  });
});

describe("M05.F01 报告汇总", () => {
  fnTest(
    ["M05.F01.I01"],
    "F01 渲染标题 + 汇总表表头（真后端 columns 穿透）",
    async () => {
      renderList();
      // B6 加载态：整页 PageLoading 门控后，标题随数据一起出现 → waitFor 断言
      await waitFor(() => {
        fixture.detectChanges();
        expect(screen.getByText("报告汇总")).toBeTruthy();
        // 真后端 columns 6 列：commissionCode/categoryCode/projectName/flowStatus/result/reportCode
        // 用 getAllByRole 找 columnheader 避免「报告类别」既在 label 又在表头
        const headers = screen.getAllByRole("columnheader");
        const labels = headers.map((h) => h.textContent ?? "");
        expect(labels).toContain("委托编号");
        expect(labels).toContain("工程名称");
        expect(labels).toContain("流程状态");
        expect(labels).toContain("结论");
        expect(labels).toContain("报告编号");
      });
    },
  );

  fnTest(
    ["M05.F01.I01"],
    "F01 列表行渲染（rows 数据穿透，编号形状锚种子委托编号字面）",
    async () => {
      renderList();
      await waitFor(() => {
        fixture.detectChanges();
        const rows = screen.getAllByRole("row");
        // 表头 + 至少 1 数据行
        expect(rows.length).toBeGreaterThan(1);
      });
      // 种子锚：渲染出的委托编号非空且全部命中 WS-2026-Fxxxx 字面形状
      const rendered = renderedCommissionCodes();
      expect(rendered.length).toBeGreaterThan(0);
      for (const code of rendered) expect(COMMISSION_CODE_RE.test(code)).toBe(true);
    },
  );

  fnTest(
    ["M05.F01.I02"],
    "F02 仪表盘统计卡片（合同/接样/样品/待办/按状态）",
    async () => {
      renderList();
      await waitFor(() => {
        fixture.detectChanges();
        expect(screen.getByText("合同数")).toBeTruthy();
        expect(screen.getByText("接样数")).toBeTruthy();
        expect(screen.getByText("样品数")).toBeTruthy();
        expect(screen.getByText("待办任务")).toBeTruthy();
        expect(screen.getByText("按状态分布")).toBeTruthy();
      });
    },
  );

  fnTest(
    ["M05.F01.I06"],
    "I06 仪表盘统计基础端点：GET /summary/stats 基础字段穿透渲染",
    async () => {
      renderList();
      await waitFor(() => {
        fixture.detectChanges();
        // 基础 4 计数从 /summary/stats 拉到（占位 '-' 消失 → 全数字）
        const grid = screen.getByText("合同数").closest("div.grid");
        expect(grid).toBeTruthy();
        expect(grid!.textContent, "统计卡不应残留加载占位 '-'").not.toContain("-");
        // 报告状态 3 桶（draft=草稿 / reviewing=审核中 / issued=已发）
        expect(screen.getByText(/草稿：\d+/)).toBeTruthy();
        expect(screen.getByText(/审核中：\d+/)).toBeTruthy();
        expect(screen.getByText(/已发：\d+/)).toBeTruthy();
      });
    },
  );

  fnTest(
    ["M05.F01.I01", "M05.F01.I02"],
    "F01+F02 报告类别下拉存在（5 类 + 全部）",
    async () => {
      renderList();
      // B6 加载态：整页 PageLoading 门控后，筛选区随数据一起出现 → waitFor
      await waitFor(() => {
        fixture.detectChanges();
        const select = screen.getByLabelText("报告类别");
        expect(select).toBeTruthy();
        expect(select.textContent).toContain("全部");
      });
    },
  );

  // REQ-2026-017：I03 核心指标卡 + I04 任务状态漏斗（真链路穿透，镜像
  // nextjs SummaryPage 同名已上线区块的断言形状：锚 data-fn 区块 + 标签，
  // 不锚易变计数值）。
  fnTest(
    ["M05.F01.I03"],
    "I03 核心指标卡三卡（今日试验/报告产出/合格率）穿透渲染",
    async () => {
      renderList();
      let section: Element | null = null;
      await waitFor(() => {
        fixture.detectChanges();
        section = document.querySelector('[data-fn="M05.F01.I03"]');
        expect(section).not.toBeNull();
      });
      expect(section!.textContent).toContain("核心指标");
      // 3 张卡片
      expect(screen.getByTestId("metric-today-tests")).toBeTruthy();
      expect(screen.getByTestId("metric-output")).toBeTruthy();
      expect(screen.getByTestId("metric-qualified-rate")).toBeTruthy();
      // stats 拉回后 detail 子节点出现（数值形状，不锚易变计数值）
      await waitFor(() => {
        fixture.detectChanges();
        expect(screen.getByTestId("metric-output-detail")).toBeTruthy();
      });
      const output = screen.getByTestId("metric-output-detail").textContent ?? "";
      expect(output).toContain("已生成");
      expect(output).toContain("待审核");
      expect(output).toContain("已签发");
      const qualified = screen.getByTestId("metric-qualified-detail").textContent ?? "";
      for (const m of ["混凝土", "钢筋", "砂石"]) {
        expect(qualified).toContain(m);
      }
      expect(qualified).toMatch(/\d+\.\d%/); // 合格率百分比形状
    },
  );

  fnTest(["M05.F01.I04"], "I04 六段任务状态漏斗穿透渲染", async () => {
    renderList();
    let section: Element | null = null;
    await waitFor(() => {
      fixture.detectChanges();
      section = document.querySelector('[data-fn="M05.F01.I04"]');
      expect(section).not.toBeNull();
    });
    expect(section!.textContent).toContain("试验任务状态");
    // stats 拉回后漏斗条渲染，6 段全部在场 + 各段计数 + 合计
    await waitFor(() => {
      fixture.detectChanges();
      expect(screen.getByTestId("funnel-bars")).toBeTruthy();
    });
    for (const key of [
      "pending_collect",
      "received",
      "testing",
      "reporting",
      "reviewing",
      "issued",
    ]) {
      const stage = screen.getByTestId(`funnel-stage-${key}`);
      expect(stage).toBeTruthy();
      expect(stage.textContent).toMatch(/\d+ 项/);
    }
    expect(screen.getByTestId("funnel-bars").textContent).toContain("合计");
  });
});
