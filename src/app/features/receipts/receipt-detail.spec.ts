// M03.F09 接样单详情 DOM 测试（REQ-2026-031 L-T3①，移植自
// lab-management-system-react/tests/features/receipts/receiptDetail.dom.test.tsx，
// 真链路语义 1:1；报告预览弹窗本批为占位壳——docx 渲染链独立切片）。
//
// 数据源：lab_dev.sample_receipts（GET /api/receipts/:id）。
// 锚定 shared 种子首行 RECEIPT-FM-0001（globalSetup 每次跑前 upsert，固定 id +
// 固定 commission_code；receiving 行，flow_history 为空）。
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
import { installRealChain, SEED } from "../../../../tests/helpers/real-chain";
import { ReceiptDetailComponent } from "./receipt-detail";

// react 同款放宽（45s 档）：真链路多 RTT，fnTest 无 options 通道 → 文件级。
vi.setConfig({ testTimeout: 90_000 });

const TARGET = SEED.receipts.find((r) => r.id === "RECEIPT-FM-0001")!;
const TARGET_CODE = TARGET.commission_code;

let fixture: ComponentFixture<TestHostComponent>;

/** 挂路由宿主并显式导航到 /receipts/:id（TestBed 初始导航不确定）。 */
async function renderDetail(id: string): Promise<ComponentFixture<TestHostComponent>> {
  window.history.replaceState({}, "", `/receipts/${id}`);
  fixture = TestBed.createComponent(TestHostComponent);
  await TestBed.inject(Router).navigateByUrl(`/receipts/${id}`);
  await settle(fixture);
  return fixture;
}

beforeEach(() => {
  localStorage.clear();
  installRealChain();
  TestBed.configureTestingModule({
    imports: [TestHostComponent],
    providers: realChainProviders([
      { path: "receipts/:id", component: ReceiptDetailComponent },
    ]),
  });
  window.history.replaceState({}, "", `/receipts/${TARGET.id}`);
});

describe("M03.F09 接样单详情", () => {
  fnTest(["M03.F09.I01"], "接样单详情：渲染标题 + 字段区（真库种子行穿透）", async () => {
    await renderDetail(TARGET.id);
    // 种子锚：标题渲染种子行固定委托书编号 + 字段区标签在场
    await waitFor(() => {
      fixture.detectChanges();
      expect(screen.getByText(`接样单详情 — ${TARGET_CODE}`)).toBeTruthy();
    });
    expect(screen.getByText("委托书编号：")).toBeTruthy();
    expect(screen.getByText(TARGET.test_category ?? "见证取样")).toBeTruthy();
  });

  fnTest(
    ["M03.F09.I02"],
    "接样单详情：流程历史时间线卡片可见（空种子时显示占位）",
    async () => {
      await renderDetail(TARGET.id);
      await waitFor(() => {
        fixture.detectChanges();
        expect(screen.getByText("流程历史")).toBeTruthy();
      });
    },
  );

  fnTest(["M03.F09.I03"], "接样单详情：报告预览按钮开弹窗", async () => {
    await renderDetail(TARGET.id);
    await waitFor(() => {
      fixture.detectChanges();
      expect(screen.getByText(`接样单详情 — ${TARGET_CODE}`)).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "报告预览" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: `报告预览 — ${TARGET_CODE}` }),
      ).toBeTruthy();
    });
  });
});
