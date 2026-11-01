// M06.F05 计算方法维护 DOM 测试（REQ-2026-031 L-T1②，移植自
// lab-management-system-react/tests/features/inspection-capability/
// inspectionCapabilityPages.dom.test.tsx M06.F05 段，真链路语义 1:1）。
//
// 复合主键 (objectCode, parameterCode)——种子计算方法行经真后端 list 穿透。
import { TestBed } from "@angular/core/testing";
import { screen, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect } from "vitest";

import { fnTest } from "../../../../tests/fn";
import { installRealChain } from "../../../../tests/helpers/real-chain";
import { realChainHttpProviders } from "../../../../tests/helpers/ng-test";
import { CalculationMethodListComponent } from "./calculation-method-list";

function renderCalc(): void {
  TestBed.configureTestingModule({ providers: [realChainHttpProviders()] });
  const fixture = TestBed.createComponent(CalculationMethodListComponent);
  fixture.detectChanges();
}

beforeEach(() => {
  installRealChain();
});

describe("M06.F05 计算方法维护", () => {
  fnTest(["M06.F05.I01"], "F05 渲染标题 + 列表行（复合主键种子穿透）", async () => {
    renderCalc();
    await waitFor(() => {
      expect(screen.getByText("计算方法维护")).toBeTruthy();
      const rows = screen.getAllByRole("row");
      expect(rows.length).toBeGreaterThan(1);
    });
  });

  fnTest(["M06.F05.I01"], "F05 新建按钮 + 行内删除按钮", async () => {
    renderCalc();
    await waitFor(() => {
      expect(screen.getByText("新建计算方法")).toBeTruthy();
      const delBtns = screen.getAllByLabelText(/^删除 /);
      expect(delBtns.length).toBeGreaterThan(0);
    });
  });
});
