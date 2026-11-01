// M06 检测能力主表 4 页 DOM 测试（REQ-2026-031 L-T1，移植自
// lab-management-system-react/tests/features/inspection-capability/inspectionCapabilityPages.dom.test.tsx，
// 真链路语义 1:1；安装/驱动差异见 tests/helpers/real-chain.ts 头注）。
//
// 真后端语义（与 shared 种子同源）：
//   - 主表 dict 路由（specialties/objects/parameters/standards）自带 code 主键
//     + keyword 过滤 + junction 聚合（link 端点客户端组合）；
//   - 测试只断言：标题、列表渲染、关键按钮存在；不调 POST/PUT/DELETE。
import { TestBed } from "@angular/core/testing";
import { screen, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect } from "vitest";

import { fnTest } from "../../../../tests/fn";
import { installRealChain } from "../../../../tests/helpers/real-chain";
import { realChainHttpProviders } from "../../../../tests/helpers/ng-test";
import {
  InspectionCapabilityListComponent,
  type CapabilityResource,
} from "./inspection-capability-list";

function renderCapability(resource: CapabilityResource): void {
  TestBed.configureTestingModule({ providers: [realChainHttpProviders()] });
  const fixture = TestBed.createComponent(InspectionCapabilityListComponent);
  fixture.componentRef.setInput("resource", resource);
  fixture.detectChanges();
}

beforeEach(() => {
  installRealChain();
});

describe("M06.F01 检测专项维护", () => {
  fnTest(["M06.F01.I01"], "F01 渲染标题 + 列表行（真库种子数据穿透）", async () => {
    renderCapability("specialties");
    await waitFor(() => {
      expect(screen.getByText("检测专项维护")).toBeTruthy();
      const rows = screen.getAllByRole("row");
      expect(rows.length).toBeGreaterThan(1);
    });
  });

  fnTest(
    ["M06.F01.I01"],
    "F01 新建按钮存在 + 编码列显示官方序号（种子锚 SP01）",
    async () => {
      renderCapability("specialties");
      await waitFor(() => {
        expect(screen.getByText("新建检测专项")).toBeTruthy();
        expect(screen.getByText("SP01")).toBeTruthy();
      });
    },
  );
});

describe("M06.F02 检测项目维护", () => {
  fnTest(["M06.F02.I01"], "F02 渲染标题 + 检测专项筛选下拉", async () => {
    renderCapability("objects");
    await waitFor(() => {
      expect(screen.getByText("检测项目维护")).toBeTruthy();
      expect(screen.getByLabelText("检测专项筛选")).toBeTruthy();
    });
  });

  fnTest(["M06.F02.I01", "M06.F02.I02"], "F02 新建按钮存在 + 行内编辑按钮", async () => {
    renderCapability("objects");
    await waitFor(() => {
      expect(screen.getByText("新建检测项目")).toBeTruthy();
      const editBtns = screen.getAllByLabelText(/^编辑 /);
      expect(editBtns.length).toBeGreaterThan(0);
    });
  });
});

describe("M06.F03 检测参数维护", () => {
  fnTest(["M06.F03.I01"], "F03 渲染标题 + 3 级筛选下拉（专项/项目/标准）", async () => {
    renderCapability("parameters");
    await waitFor(() => {
      expect(screen.getByText("检测参数维护")).toBeTruthy();
      expect(screen.getByLabelText("检测专项筛选")).toBeTruthy();
      expect(screen.getByLabelText("检测项目筛选")).toBeTruthy();
      expect(screen.getByLabelText("检测标准筛选")).toBeTruthy();
    });
  });
});

describe("M06.F04 检测标准维护", () => {
  fnTest(["M06.F04.I01"], "F04 渲染标题 + 列表行", async () => {
    renderCapability("standards");
    await waitFor(() => {
      expect(screen.getByText("检测标准维护")).toBeTruthy();
      const rows = screen.getAllByRole("row");
      expect(rows.length).toBeGreaterThan(1);
    });
  });

  fnTest(
    ["M06.F04.I01", "M06.F04.I02"],
    "F04 新建按钮存在 + 标准编码列显示（种子锚 GB 175-2023）",
    async () => {
      renderCapability("standards");
      await waitFor(() => {
        expect(screen.getByText("新建检测标准")).toBeTruthy();
        // shared 种子固定含 GB 175-2023（水泥通用标准，首屏 50 条内）
        expect(screen.getByText("GB 175-2023")).toBeTruthy();
      });
    },
  );
});
