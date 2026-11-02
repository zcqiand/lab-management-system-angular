// M03.F02 任务分配 DOM 测试（REQ-2026-031 L-T3②，移植自
// lab-management-system-react/tests/features/task-assignment/taskAssignmentList.dom.test.tsx，
// 真链路语义 1:1）。react 弹窗 → MatDialog。
//
// 数据源：lab_dev.sample_receipts，列表按 flowStatus=task_assignment 过滤。
// M03.F02.I01 双锚点（队列页渲染 + 安排按钮开弹窗，react 同款两 fnTest 同 ID）。
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
import { TaskAssignmentListComponent } from "./task-assignment-list";

// react 同款放宽（45s 档）：真链路多 RTT，fnTest 无 options 通道 → 文件级 setConfig。
vi.setConfig({ testTimeout: 90_000 });

let fixture: ComponentFixture<TestHostComponent>;

/** 挂路由宿主并显式导航到 /task-assignment（TestBed 初始导航不确定）。 */
async function renderPage(): Promise<ComponentFixture<TestHostComponent>> {
  window.history.replaceState({}, "", "/task-assignment");
  fixture = TestBed.createComponent(TestHostComponent);
  await TestBed.inject(Router).navigateByUrl("/task-assignment");
  await settle(fixture);
  return fixture;
}

beforeEach(() => {
  localStorage.clear();
  installRealChain();
  TestBed.configureTestingModule({
    imports: [TestHostComponent],
    providers: realChainProviders([
      { path: "task-assignment", component: TaskAssignmentListComponent },
    ]),
  });
  window.history.replaceState({}, "", "/task-assignment");
});

describe("M03.F02 任务分配", () => {
  fnTest(
    ["M03.F02.I01"],
    "任务分配：渲染标题 + 列表行（真库 task_assignment 种子数据穿透）",
    async () => {
      await renderPage();
      // B6 加载态：整页 PageLoading 门控后，标题随数据一起出现 → waitFor 断言
      await waitFor(() => {
        fixture.detectChanges();
        expect(screen.getByText("任务分配")).toBeTruthy();
        expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
      });
      // 种子锚：渲染出的委托书编号非空且 ⊆ shared 种子的 task_assignment 编号集
      const allowed = seedCommissionCodes("task_assignment");
      const rendered = renderedCommissionCodes();
      expect(rendered.length).toBeGreaterThan(0);
      for (const code of rendered) expect(allowed.has(code)).toBe(true);
    },
  );

  fnTest(["M03.F02.I01"], "任务分配：安排按钮开弹窗", async () => {
    await renderPage();
    await waitFor(() => {
      fixture.detectChanges();
      expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
    });
    await waitFor(
      () => {
        fixture.detectChanges();
        const btns = screen.queryAllByRole("button", { name: "安排" });
        expect(btns.length).toBeGreaterThan(0);
      },
      { timeout: 30_000 },
    );
    fireEvent.click(screen.queryAllByRole("button", { name: "安排" })[0]!);
    await waitFor(() => {
      // 弹窗标题包含 commissionCode，无法预知，用 contains 检测前缀
      expect(screen.getByRole("heading", { name: /任务安排 —/ })).toBeTruthy();
    });
  });
});
