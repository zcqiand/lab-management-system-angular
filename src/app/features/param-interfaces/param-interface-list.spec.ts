// M06.F08 参数界面维护 DOM 测试（REQ-2026-031 L-T1③，移植自
// lab-management-system-react/tests/features/param-interfaces/paramInterfaceList.dom.test.tsx，
// 真链路语义 1:1；本组用例只开弹窗不落写，无隔离负担）。
import { TestBed } from "@angular/core/testing";
import { fireEvent, screen, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect } from "vitest";

import { fnTest } from "../../../../tests/fn";
import { installRealChain } from "../../../../tests/helpers/real-chain";
import { realChainHttpProviders } from "../../../../tests/helpers/ng-test";
import { ParamInterfaceListComponent } from "./param-interface-list";

function renderList() {
  TestBed.configureTestingModule({ providers: [realChainHttpProviders()] });
  const fixture = TestBed.createComponent(ParamInterfaceListComponent);
  fixture.detectChanges();
  return fixture;
}

beforeEach(() => {
  installRealChain();
});

describe("M06.F08 参数界面维护", () => {
  fnTest(
    ["M06.F08.I01"],
    "参数界面：渲染标题 + 列表行（真后端种子数据穿透）",
    async () => {
      renderList();
      // B6 加载态：整页 PageLoading 门控后，标题随数据一起出现 → waitFor 断言
      await waitFor(() => {
        expect(screen.getByText("参数界面维护")).toBeTruthy();
        expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
      });
    },
  );

  fnTest(["M06.F08.I01"], "参数界面：新建按钮开弹窗", async () => {
    const fixture = renderList();
    await waitFor(() => {
      expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
    });
    fireEvent.click(screen.getByText("新建参数界面"));
    fixture.detectChanges();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "新建参数界面" })).toBeTruthy();
    });
  });

  fnTest(["M06.F08.I01"], "参数界面：行内删除按钮开确认弹窗", async () => {
    const fixture = renderList();
    await waitFor(() => {
      expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
    });
    const delBtns = await waitFor(() => {
      const btns = screen.getAllByRole("button", { name: "删除" });
      expect(btns.length).toBeGreaterThan(0);
      return btns;
    });
    fireEvent.click(delBtns[0]!);
    fixture.detectChanges();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "删除参数界面" })).toBeTruthy();
    });
  });
});
