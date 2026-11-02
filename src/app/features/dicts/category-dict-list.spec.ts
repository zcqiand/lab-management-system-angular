// M04.F06-F09 型号/规格/等级/牌号维护 4 页 DOM 测试（REQ-2026-031 L-T2，移植自
// lab-management-system-react/tests/features/dicts/categoryDictPages.dom.test.tsx，
// 真链路语义 1:1；本组用例只开弹窗不落写，拖拽排序不在 jsdom 冒烟范围）。
import { TestBed } from "@angular/core/testing";
import { fireEvent, screen, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect, vi } from "vitest";

import { fnTest } from "../../../../tests/fn";
import { installRealChain, SEED } from "../../../../tests/helpers/real-chain";
import { realChainHttpProviders } from "../../../../tests/helpers/ng-test";
import { CategoryDictListComponent } from "./category-dict-list";

// react 同款放宽：检测项目树（111 行）+ 牌号列表两轮真库请求，--all 重负载下
// 全局 30s 不够（fnTest 无 options 通道，文件级 setConfig 等价 react 单测 timeout）。
vi.setConfig({ testTimeout: 90_000 });

const P2 = SEED.inspectionObjects.find((o) => o.code === "OBJ-SP01-P2")!;
/** OBJ-SP01-P2 的种子牌号名（字典序首个，固定 id 锚） */
const P2_BRAND_NAME = SEED.inspectionBrands
  .filter((b) => b.inspection_object_code === P2.code)
  .map((b) => b.name)
  .sort()[0]!;

function renderDict(endpoint: string, title: string, extra: Record<string, string> = {}) {
  TestBed.configureTestingModule({ providers: [realChainHttpProviders()] });
  const fixture = TestBed.createComponent(CategoryDictListComponent);
  fixture.componentRef.setInput("endpoint", endpoint);
  fixture.componentRef.setInput("title", title);
  for (const [k, v] of Object.entries(extra)) {
    fixture.componentRef.setInput(k, v);
  }
  fixture.detectChanges();
  return fixture;
}

beforeEach(() => {
  installRealChain();
});

describe("M04.F06-F09 码表维护 4 页", () => {
  /** 等左侧检测项目树真实加载（真库 inspection_objects 渲染出可选节点）。
   *  B6 加载态：整页 PageLoading 门控后，树随首屏数据一起出现 → 放宽 waitFor。 */
  async function waitForTree(fixture: ReturnType<typeof TestBed.createComponent>) {
    await waitFor(
      () => {
        fixture.detectChanges();
        const nodes = document.querySelectorAll("aside ul li button");
        expect(nodes.length).toBeGreaterThan(0);
      },
      { timeout: 30_000 },
    );
  }

  /** 点左侧树「钢筋（含焊接与机械连接）」节点，等右侧列表行渲染。
   *  点击验效进轮询（react selectRebarAndAwaitRows 同款吸收重门控瞬窗空打）：
   *  每轮看「钢筋」是否已带 active 态（is-active 类），没带就（重）点，
   *  点生效才放行走行断言。 */
  async function selectRebarAndAwaitRows(
    fixture: ReturnType<typeof TestBed.createComponent>,
  ) {
    await waitFor(
      () => {
        fixture.detectChanges();
        const btn = [...document.querySelectorAll("aside ul li button")].find((b) =>
          b.textContent?.includes("钢筋"),
        );
        expect(btn).toBeTruthy();
        if (!btn?.classList.contains("is-active")) {
          fireEvent.click(btn as HTMLElement);
        }
        fixture.detectChanges();
        const active = [...document.querySelectorAll("aside ul li button")].some(
          (b) => b.classList.contains("is-active") && b.textContent?.includes("钢筋"),
        );
        expect(active).toBe(true);
      },
      { timeout: 60_000 },
    );
    await waitFor(
      () => {
        fixture.detectChanges();
        expect(screen.getAllByRole("button", { name: "删除" }).length).toBeGreaterThan(0);
      },
      { timeout: 45_000 },
    );
  }

  /** 行内「删除」按钮点击验效：按钮获取、点击、弹窗 h2 验效进同一轮询，
   *  弹窗出现才算点击生效；弹窗已开则不重复点（react 同款）。 */
  async function clickDeleteAndAwaitDialog(
    fixture: ReturnType<typeof TestBed.createComponent>,
  ) {
    await waitFor(
      () => {
        fixture.detectChanges();
        const delBtn = screen.queryAllByRole("button", { name: "删除" })[0];
        if (document.querySelector("h2")?.textContent !== "删除确认") {
          expect(delBtn).toBeTruthy();
          fireEvent.click(delBtn as HTMLElement);
        }
        fixture.detectChanges();
        expect(document.querySelector("h2")?.textContent).toBe("删除确认");
      },
      { timeout: 45_000 },
    );
  }

  fnTest(
    ["M04.F06.I01"],
    "型号维护：渲染标题 + 检测项目树 + 默认选中项目下列表（真库穿透）",
    async () => {
      const fixture = renderDict("/models", "型号维护", { dataFn: "M04.F06.I01" });
      await waitFor(() => {
        fixture.detectChanges();
        expect(screen.getByText("型号维护")).toBeTruthy();
      });
      await waitForTree(fixture);
      // 种子锚：默认选中首个检测项目，其下种子型号行渲染
      await waitFor(() => {
        fixture.detectChanges();
        expect(
          document.querySelectorAll('[data-testid="/models-list"] li').length,
        ).toBeGreaterThan(0);
      });
    },
  );

  fnTest(["M04.F07.I01"], "规格维护：渲染标题不炸", async () => {
    const fixture = renderDict("/specifications", "规格维护", {
      dataFn: "M04.F07.I01",
    });
    await waitFor(() => {
      fixture.detectChanges();
      expect(screen.getByText("规格维护")).toBeTruthy();
    });
    await waitForTree(fixture);
  });

  fnTest(["M04.F08.I01"], "等级维护：渲染标题不炸", async () => {
    const fixture = renderDict("/grades", "等级维护", { dataFn: "M04.F08.I01" });
    await waitFor(() => {
      fixture.detectChanges();
      expect(screen.getByText("等级维护")).toBeTruthy();
    });
    await waitForTree(fixture);
  });

  fnTest(
    ["M04.F09.I01"],
    "牌号维护：牌号种子行渲染（真库 OBJ-SP01-P2 种子穿透）",
    async () => {
      const fixture = renderDict("/brands", "牌号维护", { dataFn: "M04.F09.I01" });
      await waitFor(() => {
        fixture.detectChanges();
        expect(screen.getByText("牌号维护")).toBeTruthy();
      });
      // 种子锚：选中「钢筋」后其下种子牌号行渲染（牌号全部挂在 P2，水泥下为空）
      await selectRebarAndAwaitRows(fixture);
      await waitFor(() => {
        fixture.detectChanges();
        expect(screen.getAllByText(P2_BRAND_NAME).length).toBeGreaterThan(0);
      });
    },
  );

  fnTest(
    ["M04.F06.I02"],
    "型号维护：新建按钮开弹窗（检测项目/名称/备注表单）",
    async () => {
      const fixture = renderDict("/models", "型号维护", {
        createDataFn: "M04.F06.I02",
      });
      await waitForTree(fixture);
      fireEvent.click(screen.getByRole("button", { name: "新建" }));
      fixture.detectChanges();
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "新建型号" })).toBeTruthy();
      });
      // Material MDC 表单字段的 label 文本落在内层 <mat-label>（不是 <label> 本身）
      expect(screen.getByText("检测项目", { selector: "mat-label" })).toBeTruthy();
    },
  );

  fnTest(["M04.F06.I04"], "型号维护：行内删除按钮开确认弹窗", async () => {
    const fixture = renderDict("/models", "型号维护", {
      deleteDataFn: "M04.F06.I04",
    });
    await selectRebarAndAwaitRows(fixture);
    await clickDeleteAndAwaitDialog(fixture);
  });

  fnTest(["M04.F07.I02"], "规格维护：新建按钮开弹窗", async () => {
    const fixture = renderDict("/specifications", "规格维护", {
      createDataFn: "M04.F07.I02",
    });
    await waitForTree(fixture);
    fireEvent.click(screen.getByRole("button", { name: "新建" }));
    fixture.detectChanges();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "新建规格" })).toBeTruthy();
    });
  });

  fnTest(["M04.F07.I04"], "规格维护：行内删除按钮开确认弹窗", async () => {
    const fixture = renderDict("/specifications", "规格维护", {
      deleteDataFn: "M04.F07.I04",
    });
    await selectRebarAndAwaitRows(fixture);
    await clickDeleteAndAwaitDialog(fixture);
  });

  fnTest(["M04.F08.I02"], "等级维护：新建按钮开弹窗", async () => {
    const fixture = renderDict("/grades", "等级维护", {
      createDataFn: "M04.F08.I02",
    });
    await waitForTree(fixture);
    fireEvent.click(screen.getByRole("button", { name: "新建" }));
    fixture.detectChanges();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "新建等级" })).toBeTruthy();
    });
  });

  fnTest(["M04.F08.I04"], "等级维护：行内删除按钮开确认弹窗", async () => {
    const fixture = renderDict("/grades", "等级维护", {
      deleteDataFn: "M04.F08.I04",
    });
    await selectRebarAndAwaitRows(fixture);
    await clickDeleteAndAwaitDialog(fixture);
  });

  fnTest(["M04.F09.I02"], "牌号维护：新建按钮开弹窗", async () => {
    const fixture = renderDict("/brands", "牌号维护", {
      createDataFn: "M04.F09.I02",
    });
    await waitForTree(fixture);
    fireEvent.click(screen.getByRole("button", { name: "新建" }));
    fixture.detectChanges();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "新建牌号" })).toBeTruthy();
    });
  });

  fnTest(["M04.F09.I03"], "牌号维护：行内删除按钮开确认弹窗", async () => {
    const fixture = renderDict("/brands", "牌号维护", {
      deleteDataFn: "M04.F09.I03",
    });
    await selectRebarAndAwaitRows(fixture);
    await clickDeleteAndAwaitDialog(fixture);
  });
});
