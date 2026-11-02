// soil 双卡（SoilCompactionCard / SoilCompactionDegreeCard）算法 + 渲染单测
//（REQ-2026-031 L-T3③，移植自 lab-management-system-react
// tests/features/data-entry/soilCards.dom.test.tsx，断言 1:1）。
import { Type } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideZonelessChangeDetection } from "@angular/core";
import type { ComponentFixture } from "@angular/core/testing";
import { describe, expect, it, vi } from "vitest";

import { fnTest } from "../../../../../tests/fn";
import {
  SoilCompactionCardComponent,
  computeCompactionPeak,
} from "./soil-compaction-card";
import {
  SoilCompactionDegreeCardComponent,
  computeCompactionDegree,
} from "./soil-compaction-degree-card";
import type { ParamCardBase } from "./param-card-base";
import type { ParamCardPatch } from "./types";
import type { InspectionParameter } from "../../../../api/endpoints/model/inspectionParameter";

vi.setConfig({ testTimeout: 90_000 });

describe("computeCompactionPeak 二次拟合", () => {
  it("有效点 < 3 → 回退实测最大干密度点", () => {
    const r = computeCompactionPeak([
      { moisture: 10, dryDensity: 1.8 },
      { moisture: 12, dryDensity: 1.85 },
    ]);
    expect(r.maxDryDensity).toBe(1.85);
    expect(r.optimalMoisture).toBe(12);
  });

  it("3+ 点峰值在中间 → 二次拟合顶点", () => {
    const r = computeCompactionPeak([
      { moisture: 8, dryDensity: 1.7 },
      { moisture: 12, dryDensity: 1.9 },
      { moisture: 16, dryDensity: 1.8 },
    ]);
    expect(r.maxDryDensity).toBeGreaterThan(1.9);
    expect(r.optimalMoisture).toBeGreaterThan(11);
    expect(r.optimalMoisture).toBeLessThan(13);
  });

  it("全部 0 → undefined", () => {
    const r = computeCompactionPeak([
      { moisture: 0, dryDensity: 0 },
      { moisture: 0, dryDensity: 0 },
    ]);
    expect(r.maxDryDensity).toBeUndefined();
    expect(r.optimalMoisture).toBeUndefined();
  });
});

describe("computeCompactionDegree", () => {
  it("缺输入 → 干密度/压实度 = 0，verdict = ''", () => {
    const r = computeCompactionDegree(
      { code: "", part: "", layer: "", designDegree: 96, wetDensity: 0, moisture: 0 },
      1.9,
    );
    expect(r.dryDensity).toBe(0);
    expect(r.degree).toBe(0);
    expect(r.verdict).toBe("");
  });

  it("湿密度 1.92，含水率 10% → 干密度 ≈ 1.745，压实度 ≈ 91.8%（1.9 最大干密度）", () => {
    const r = computeCompactionDegree(
      { code: "", part: "", layer: "", designDegree: 96, wetDensity: 1.92, moisture: 10 },
      1.9,
    );
    expect(r.dryDensity).toBeCloseTo(1.745, 2);
    expect(r.degree).toBeCloseTo(91.8, 1);
    expect(r.verdict).toBe("不合格"); // 91.8 < 96
  });

  it("压实度达标 → 合格", () => {
    const r = computeCompactionDegree(
      { code: "", part: "", layer: "", designDegree: 96, wetDensity: 2.0, moisture: 5 },
      1.9,
    );
    expect(r.verdict).toBe("合格");
  });
});

// ---- 卡片渲染（react render+fireEvent → TestBed setInput+fireEvent）----

const param = (code: string, name: string, unit?: string): InspectionParameter =>
  ({
    code,
    name,
    rawName: name,
    canonicalName: name,
    aliases: [],
    unit,
    sourceType: "official",
    sortOrder: 1,
    createdAt: "",
    updatedAt: "",
  }) as InspectionParameter;

/** 建卡：signal inputs 逐个 setInput（ParamCardBase 九键全量）。 */
function makeCard(
  component: Type<ParamCardBase>,
  over: {
    parameter?: InspectionParameter;
    config?: Record<string, unknown>;
    readOnly?: boolean;
  } = {},
): {
  el: HTMLElement;
  fixture: ComponentFixture<ParamCardBase>;
  patches: ParamCardPatch[];
} {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [component],
    providers: [provideZonelessChangeDetection()],
  });
  const fixture = TestBed.createComponent(component);
  fixture.componentRef.setInput(
    "parameter",
    over.parameter ?? param("IP-0226", "最大干密度"),
  );
  fixture.componentRef.setInput("record", undefined);
  fixture.componentRef.setInput("sampleId", "s1");
  fixture.componentRef.setInput("standards", []);
  fixture.componentRef.setInput("stdParams", []);
  fixture.componentRef.setInput("techReqs", []);
  fixture.componentRef.setInput("config", over.config ?? undefined);
  fixture.componentRef.setInput("readOnly", over.readOnly ?? false);
  const patches: ParamCardPatch[] = [];
  fixture.componentRef.setInput("cardChange", (p: ParamCardPatch) => patches.push(p));
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, fixture, patches };
}

function fireInput(el: HTMLElement, selector: string, value: string): void {
  const node = el.querySelector<HTMLInputElement>(selector)!;
  node.value = value;
  node.dispatchEvent(new Event("input", { bubbles: true }));
}

fnTest(
  ["M03.F03.I01"],
  "SoilCompactionCard 渲染 5 组（默认 pointCount=5）+ GB/T 50123-2019 标识",
  () => {
    const { el } = makeCard(SoilCompactionCardComponent);
    expect(
      el.querySelectorAll('input[aria-label^="第"][aria-label$="组含水率"]').length,
    ).toBe(5);
    expect(el.textContent).toContain("GB/T 50123-2019");
  },
);

fnTest(["M03.F03.I02"], "SoilCompactionCard 录入含水率 + 干密度 → 最大干密度上屏", () => {
  const { el, fixture } = makeCard(SoilCompactionCardComponent);
  const values: Array<[string, string]> = [
    ["10", "1.7"],
    ["12", "1.9"],
    ["14", "1.8"],
  ];
  values.forEach(([w, d], i) => {
    fireInput(el, `input[aria-label="第 ${i + 1} 组含水率"]`, w);
    fireInput(el, `input[aria-label="第 ${i + 1} 组干密度"]`, d);
  });
  fixture.detectChanges(); // zoneless：native 事件后手动 CD 刷 DOM
  expect(el.querySelector('[data-testid="max-dry-density"]')?.textContent).toBeTruthy();
  expect(el.querySelector('[data-testid="optimal-moisture"]')?.textContent).toBeTruthy();
});

fnTest(
  ["M03.F03.I01"],
  "SoilCompactionDegreeCard 渲染 6 行（默认 rowCount=6）+ 最大干密度输入",
  () => {
    const { el } = makeCard(SoilCompactionDegreeCardComponent, {
      parameter: param("IP-0456", "压实度"),
    });
    expect(
      el.querySelectorAll('input[aria-label^="第"][aria-label$="行试样编号"]').length,
    ).toBe(6);
    expect(el.querySelector('input[aria-label="最大干密度"]')).toBeTruthy();
  },
);

fnTest(
  ["M03.F03.I02"],
  "SoilCompactionDegreeCard 录入湿密度 + 含水率 → 干密度 + 压实度上屏",
  () => {
    const { el, fixture } = makeCard(SoilCompactionDegreeCardComponent, {
      parameter: param("IP-0456", "压实度"),
    });
    fireInput(el, 'input[aria-label="最大干密度"]', "1.9");
    fireInput(el, 'input[aria-label="第 1 行湿密度"]', "1.92");
    fireInput(el, 'input[aria-label="第 1 行含水率"]', "10");
    fixture.detectChanges(); // zoneless：native 事件后手动 CD 刷 DOM
    expect(el.querySelector('[data-testid="dry-density-0"]')?.textContent).toBeTruthy();
    expect(el.querySelector('[data-testid="degree-0"]')?.textContent).toBeTruthy();
  },
);
