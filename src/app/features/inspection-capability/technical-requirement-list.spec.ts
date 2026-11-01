// M06.F06 技术要求维护 DOM 测试（REQ-2026-031 L-T1②，移植自
// lab-management-system-react/tests/features/inspection-capability/
// inspectionCapabilityPages.dom.test.tsx M06.F06 段，真链路语义 1:1）。
import { TestBed } from "@angular/core/testing";
import { screen, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect } from "vitest";

import { fnTest } from "../../../../tests/fn";
import { installRealChain } from "../../../../tests/helpers/real-chain";
import { realChainHttpProviders } from "../../../../tests/helpers/ng-test";
import { typeInto } from "../../../../tests/helpers/ng-test";
import { TechnicalRequirementListComponent } from "./technical-requirement-list";

function renderTech(): void {
  TestBed.configureTestingModule({ providers: [realChainHttpProviders()] });
  const fixture = TestBed.createComponent(TechnicalRequirementListComponent);
  fixture.detectChanges();
}

beforeEach(() => {
  installRealChain();
});

describe("M06.F06 技术要求维护", () => {
  fnTest(["M06.F06.I01"], "F06 渲染标题 + 4 维筛选（牌号/型号/等级/规格）", async () => {
    renderTech();
    // B6 加载态：整页 PageLoading 门控后，标题/筛选随数据一起出现 → waitFor 断言
    await waitFor(() => {
      expect(screen.getByText("技术要求维护")).toBeTruthy();
      expect(screen.getByLabelText("牌号筛选")).toBeTruthy();
      expect(screen.getByLabelText("型号筛选")).toBeTruthy();
      expect(screen.getByLabelText("等级筛选")).toBeTruthy();
      expect(screen.getByLabelText("规格筛选")).toBeTruthy();
    });
  });

  fnTest(
    ["M06.F06.I01", "M06.F06.I02", "M06.F06.I05"],
    "F06 列表渲染（种子穿透）+ 新建按钮",
    async () => {
      renderTech();
      await waitFor(() => {
        expect(screen.getByText("新建技术要求")).toBeTruthy();
        const rows = screen.getAllByRole("row");
        expect(rows.length).toBeGreaterThan(1);
      });
    },
  );

  fnTest(["M06.F06.I01"], "F06 4 维筛选输入可达（input 事件模拟）", async () => {
    renderTech();
    const brand = await waitFor(() => {
      const el = screen.getByLabelText("牌号筛选") as HTMLInputElement;
      return el;
    });
    typeInto(brand, "P·O 42.5");
    expect(brand.value).toBe("P·O 42.5");
  });
});
