// M02.F01 合同管理 DOM 测试（REQ-2026-031 L-T2，移植自
// lab-management-system-react/tests/features/contracts/contractsList.dom.test.tsx，
// 真链路语义 1:1；本组用例只开弹窗不落写，无隔离负担）。
import { TestBed } from "@angular/core/testing";
import { fireEvent, screen, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect } from "vitest";

import { fnTest } from "../../../../tests/fn";
import { installRealChain, SEED } from "../../../../tests/helpers/real-chain";
import { realChainHttpProviders } from "../../../../tests/helpers/ng-test";
import { ContractsListComponent } from "./contracts-list";

beforeEach(() => {
  installRealChain();
});

function renderList() {
  TestBed.configureTestingModule({ providers: [realChainHttpProviders()] });
  const fixture = TestBed.createComponent(ContractsListComponent);
  fixture.detectChanges();
  return fixture;
}

describe("M02.F01 合同管理", () => {
  fnTest(
    ["M02.F01.I01"],
    "合同列表：渲染标题 + 列表行（真后端契约数据穿透）",
    async () => {
      const fixture = renderList();
      // B6 加载态：整页 PageLoading 门控后，标题随数据一起出现 → waitFor 断言
      await waitFor(() => {
        fixture.detectChanges();
        expect(screen.getByText("合同管理")).toBeTruthy();
        expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
      });
      // 种子锚：种子合同的编号至少渲染出一份（首行合同编号固定在场）
      expect(screen.getByText(SEED.contracts[0]!.contract_code)).toBeTruthy();
    },
  );

  fnTest(["M02.F01.I02"], "合同管理：新建按钮开弹窗", async () => {
    const fixture = renderList();
    await waitFor(() => {
      fixture.detectChanges();
      expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
    });
    fireEvent.click(screen.getByRole("button", { name: "新建合同" }));
    fixture.detectChanges();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "新建合同" })).toBeTruthy();
    });
  });

  fnTest(["M02.F01.I03"], "合同管理：行内删除按钮开确认弹窗", async () => {
    const fixture = renderList();
    await waitFor(() => {
      fixture.detectChanges();
      expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
    });
    const delBtns = await waitFor(() => {
      fixture.detectChanges();
      const btns = screen.getAllByRole("button", { name: "删除" });
      expect(btns.length).toBeGreaterThan(0);
      return btns;
    });
    fireEvent.click(delBtns[0]!);
    fixture.detectChanges();
    await waitFor(() => {
      // 弹窗标题（h2）渲染即视为开
      expect(screen.getByRole("heading", { name: "删除合同" })).toBeTruthy();
    });
  });
});
