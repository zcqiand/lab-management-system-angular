// M03.F01 接样管理 DOM 测试（REQ-2026-031 L-T3①，移植自
// lab-management-system-react/tests/features/receipts/receiptsList.dom.test.tsx，
// 真链路语义 1:1）。react 弹窗/toast → MatDialog/页内成功条。
//
// 数据源：lab_dev.sample_receipts（globalSetup 每次跑前 upsert shared 种子）。
// 写路径（POST /api/receipts/receiving/act）用 WS-TEST-T8 前缀新建行承载：
// commissionDate=2099 使其稳定排在列表首位，afterEach 删行回收，不碰种子行。
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { fireEvent, screen, waitFor } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { firstValueFrom } from "rxjs";

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
import { ReceiptsService } from "../../../api/endpoints/receipts/receipts.service";
import { compactParams } from "../../../api/params";
import { ReceiptsListComponent } from "./receipts-list";

// react 同款放宽：接样是全家族最大表（种子 210 行）+ 列表两轮加载 + 写路径
// 5+ RTT —— fnTest 无 options 通道，文件级 setConfig 等价 react 单测 timeout。
vi.setConfig({ testTimeout: 120_000 });

let fixture: ComponentFixture<TestHostComponent>;
let receipts: ReceiptsService;
/** 写路径隔离：TEST 行按精确 id 回收（POST 由服务端生成 id，客户端持有） */
let createdId: string | null = null;

/** 挂路由宿主并显式导航到 /receipts（TestBed 初始导航不确定）。 */
async function renderList(): Promise<ComponentFixture<TestHostComponent>> {
  window.history.replaceState({}, "", "/receipts");
  fixture = TestBed.createComponent(TestHostComponent);
  await TestBed.inject(Router).navigateByUrl("/receipts");
  await settle(fixture);
  return fixture;
}

beforeEach(async () => {
  localStorage.clear();
  installRealChain();
  TestBed.configureTestingModule({
    imports: [TestHostComponent],
    providers: realChainProviders([
      { path: "receipts", component: ReceiptsListComponent },
    ]),
  });
  receipts = TestBed.inject(ReceiptsService);
  // 清扫上次异常中断残留的 TEST 行（幂等隔离；正常路径 afterEach 已删）
  const stale = await firstValueFrom(
    receipts.receiptsListReceipts(
      compactParams({ keyword: "WS-TEST-T8", page: 1, pageSize: 100 }),
    ),
  );
  for (const row of stale.items) {
    await firstValueFrom(receipts.receiptsDeleteReceipt(row.id));
  }
  window.history.replaceState({}, "", "/receipts");
}, 45_000);

afterEach(async () => {
  if (createdId) {
    await firstValueFrom(receipts.receiptsDeleteReceipt(createdId)).catch(() => {});
    createdId = null;
  }
}, 30_000);

/** 等列表行渲染到非空（真链路异步查询 + zoneless CD 轮询驱动）。 */
async function waitRows(): Promise<void> {
  await waitFor(
    () => {
      fixture.detectChanges();
      expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
    },
    { timeout: 60_000 },
  );
}

describe("M03.F01 接样管理", () => {
  fnTest(
    ["M03.F01.I01"],
    "接样管理：渲染标题 + 列表行（真库种子数据穿透，接样中阶段级 subset）",
    async () => {
      await renderList();
      // B6 加载态：整页 PageLoading 门控后，标题随数据一起出现 → waitFor 断言
      await waitFor(() => {
        fixture.detectChanges();
        expect(screen.getByText("接样管理")).toBeTruthy();
      });
      await waitRows();
      // 种子锚（阶段级 subset）：切「接样中」过滤（flowStatus=receiving）后，
      // 渲染出的委托书编号必须 ⊆ shared 种子的 receiving 编号集。组件语义是
      // select 只改状态，点「搜索」才 refetch——与真用户操作同构。
      const allowed = seedCommissionCodes("receiving");
      fireEvent.change(document.querySelector("select")!, {
        target: { value: "receiving" },
      });
      fireEvent.click(screen.getByRole("button", { name: "搜索" }));
      await waitFor(
        () => {
          fixture.detectChanges();
          const rendered = renderedCommissionCodes();
          expect(rendered.length).toBeGreaterThan(0);
          for (const code of rendered) expect(allowed.has(code)).toBe(true);
        },
        { timeout: 60_000 },
      );
    },
  );

  fnTest(["M03.F01.I02"], "接样管理：新建按钮开弹窗", async () => {
    await renderList();
    await waitRows();
    fireEvent.click(screen.getByRole("button", { name: "新建接样" }));
    await waitFor(() => {
      expect(screen.getByText("新建接样", { selector: "h2" })).toBeTruthy();
    });
  });

  fnTest(["M03.F01.I03"], "接样管理：行内删除按钮开确认弹窗", async () => {
    await renderList();
    await waitRows();
    // 仅 flowStatus='receiving' 的接样单渲染删除按钮（已提交单据无删除）
    await waitFor(
      () => {
        fixture.detectChanges();
        const btns = screen.queryAllByRole("button", { name: "删除" });
        expect(btns.length).toBeGreaterThan(0);
      },
      { timeout: 30_000 },
    );
    fireEvent.click(screen.queryAllByRole("button", { name: "删除" })[0]!);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "删除接样" })).toBeTruthy();
    });
  });

  fnTest(
    ["M03.F01.I04"],
    "接样管理：提交按钮调真 POST /api/receipts/receiving/act 推进 receiving → task_assignment",
    async () => {
      // 隔离：新建 TEST 行（不碰种子行），commissionDate 放未来使其稳定排列表首
      const created = await firstValueFrom(
        receipts.receiptsCreateReceipt({
          contractId: "CONTRACT-001",
          commissionCode: "WS-TEST-T8-0001",
          commissionDate: "2099-12-31",
          projectName: "T8 真链路写路径用例",
          clientUnit: "T8 测试委托单位",
          testCategory: "见证取样",
          sampleSource: "现场",
          categoryCode: "RN-101",
          receivedBy: "t8-tester",
        }),
      );
      createdId = created.id;
      expect(createdId).toBeTruthy();

      await renderList();
      // TEST 行 commissionDate=2099 按委托日期倒序必排第一行
      await waitFor(() => {
        fixture.detectChanges();
        expect(screen.getByText("WS-TEST-T8-0001")).toBeTruthy();
      });
      const beforeSubmit = screen.queryAllByRole("button", { name: "提交" }).length;
      await waitFor(
        () => {
          fixture.detectChanges();
          expect(
            screen.queryAllByRole("button", { name: "提交" }).length,
          ).toBeGreaterThan(0);
        },
        { timeout: 30_000 },
      );
      fireEvent.click(screen.queryAllByRole("button", { name: "提交" })[0]!);
      // 真 flow 落库：成功提示 + 该行提交按钮随列表刷新消失
      await waitFor(() => {
        fixture.detectChanges();
        expect(screen.getByText("接样单已提交到任务安排")).toBeTruthy();
      });
      await waitFor(() => {
        fixture.detectChanges();
        expect(screen.queryAllByRole("button", { name: "提交" }).length).toBe(
          beforeSubmit - 1,
        );
      });
      const after = await firstValueFrom(receipts.receiptsGetReceipt(createdId));
      expect(after.flowStatus).toBe("task_assignment");
    },
  );
});
