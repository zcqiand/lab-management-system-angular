// M03.F03 数据录入 DOM 测试（REQ-2026-031 L-T3②，移植自
// lab-management-system-react/tests/features/data-entry/dataEntryPage.dom.test.tsx，
// 真链路语义 1:1）。弹窗内参数卡本批仅 DefaultParamCard（11 张域卡 L-T3③）。
//
// 数据源：列表 = lab_dev.sample_receipts（flowStatus=data_entry 过滤）；
// 弹窗 = GET /api/samples、/api/inspection/parameters、/api/test-records（真后端）。
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { fireEvent, screen, waitFor } from "@testing-library/dom";
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
import { DataEntryComponent } from "./data-entry";

// react 同款放宽（45s 档）：真链路多 RTT，fnTest 无 options 通道 → 文件级 setConfig。
vi.setConfig({ testTimeout: 90_000 });

let fixture: ComponentFixture<TestHostComponent>;

/** 挂路由宿主并显式导航到 /data-entry（TestBed 初始导航不确定）。 */
async function renderPage(): Promise<ComponentFixture<TestHostComponent>> {
  window.history.replaceState({}, "", "/data-entry");
  fixture = TestBed.createComponent(TestHostComponent);
  await TestBed.inject(Router).navigateByUrl("/data-entry");
  await settle(fixture);
  return fixture;
}

beforeEach(() => {
  localStorage.clear();
  installRealChain();
  TestBed.configureTestingModule({
    imports: [TestHostComponent],
    providers: realChainProviders([
      { path: "data-entry", component: DataEntryComponent },
    ]),
  });
  window.history.replaceState({}, "", "/data-entry");
});

describe("M03.F03 数据录入", () => {
  fnTest(
    ["M03.F03.I01"],
    "数据录入：渲染标题 + 列表行（真库 data_entry 种子数据穿透）",
    async () => {
      await renderPage();
      // B6 加载态：整页 PageLoading 门控后，标题随数据一起出现 → waitFor 断言
      await waitFor(() => {
        fixture.detectChanges();
        expect(screen.getByText("数据录入")).toBeTruthy();
        expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
      });
      // 种子锚：渲染出的委托书编号非空且 ⊆ shared 种子的 data_entry 编号集
      const allowed = seedCommissionCodes("data_entry");
      const rendered = renderedCommissionCodes();
      expect(rendered.length).toBeGreaterThan(0);
      for (const code of rendered) expect(allowed.has(code)).toBe(true);
    },
  );

  fnTest(
    ["M03.F03.I03"],
    "数据录入：行内「录入结果」按钮（人工改判 verdict 入口）",
    async () => {
      await renderPage();
      await waitFor(() => {
        fixture.detectChanges();
        expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
      });
      await waitFor(
        () => {
          fixture.detectChanges();
          const btns = screen.queryAllByRole("button", { name: "录入结果" });
          expect(btns.length).toBeGreaterThan(0);
        },
        { timeout: 30_000 },
      );
      fireEvent.click(screen.queryAllByRole("button", { name: "录入结果" })[0]!);
      // 弹窗标题包含 commissionCode
      await waitFor(() => {
        const titles = screen.getAllByRole("heading", { name: /录入结果 —/ });
        expect(titles.length).toBeGreaterThan(0);
      });
    },
  );

  fnTest(
    ["M03.F03.I02"],
    "数据录入：弹窗内「保存检测记录」按钮可见（M03.F03.I02 data-fn 锚点）",
    async () => {
      await renderPage();
      await waitFor(() => {
        fixture.detectChanges();
        expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
      });
      await waitFor(
        () => {
          fixture.detectChanges();
          const btns = screen.queryAllByRole("button", { name: "录入结果" });
          expect(btns.length).toBeGreaterThan(0);
        },
        { timeout: 30_000 },
      );
      fireEvent.click(screen.queryAllByRole("button", { name: "录入结果" })[0]!);
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "保存" })).toBeTruthy();
      });
    },
  );
});
