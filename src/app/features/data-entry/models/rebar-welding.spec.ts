// rebarWelding 算法 + RebarWeldingTensileCard / RebarWeldingBendCard 单测
//（REQ-2026-031 L-T3③，移植自 lab-management-system-react
// tests/features/data-entry/rebarWelding.dom.test.tsx，断言 1:1）。
// 3 试件共享规格 Φ22（硬编码），抗拉 Rm = 4000·F/(π·d²)，弯曲按 JGJ/T 27-2014 §6.2。
// 注：react 测试注释写 263.2 但断言 "263.1"（400000/1520.53=263.07→圆整 0.1）——照抄断言。
import { Type } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideZonelessChangeDetection } from "@angular/core";
import type { ComponentFixture } from "@angular/core/testing";
import { expect, vi } from "vitest";

import { fnTest } from "../../../../../tests/fn";
import {
  tensileStrength,
  REBAR_DIAMETER_MM,
  meanOfSpecimen,
  parseTensileRecord,
  parseBendRecord,
} from "./rebar-welding";
import type { TensileSpecimen } from "./rebar-welding";
import { RebarWeldingTensileCardComponent } from "./rebar-welding-tensile-card";
import { RebarWeldingBendCardComponent } from "./rebar-welding-bend-card";
import type { ParamCardBase } from "./param-card-base";
import type { InspectionParameter } from "../../../../api/endpoints/model/inspectionParameter";

vi.setConfig({ testTimeout: 90_000 });

fnTest(["M03.F03.I01"], "rebar-welding：抗拉 Rm=4000·F/(π·d²)（Φ22）", () => {
  expect(REBAR_DIAMETER_MM).toBe(22);
  // 100 kN → Rm ≈ 263 MPa（按公式 4000·100/(π·484) = 263.16）
  expect(tensileStrength(100, 22)).toBeCloseTo(263.2, 0);
  expect(tensileStrength(0, 22)).toBe(0);
  expect(tensileStrength(100, 0)).toBe(0);
});

fnTest(["M03.F03.I01"], "rebar-welding：meanOfSpecimen 算术平均", () => {
  const spec: TensileSpecimen = {
    techReqId: "",
    techReqLabel: "",
    loads: [100, 110, 120],
    strengths: [
      tensileStrength(100, 22),
      tensileStrength(110, 22),
      tensileStrength(120, 22),
    ],
    fractureDistances: [0, 0, 0],
    fractureCharacteristics: ["", "", ""],
  };
  const m = meanOfSpecimen(spec);
  expect(m).toBeGreaterThan(260);
  expect(m).toBeLessThan(290);
});

fnTest(["M03.F03.I01"], "rebar-welding：parseTensileRecord 反序列化", () => {
  const raw = JSON.stringify({
    loads: [100, 110, 120],
    strengths: [263.2, 289.5, 315.8],
    fractureDistances: [10, 20, 30],
    fractureCharacteristics: ["母材断裂", "焊缝断裂", "热影响区断裂"],
  });
  const p = parseTensileRecord(raw);
  expect(p.loads).toEqual([100, 110, 120]);
  expect(p.strengths).toEqual([263.2, 289.5, 315.8]);
  expect(parseTensileRecord(undefined).loads).toEqual([0, 0, 0]);
  expect(parseTensileRecord("{bad").strengths).toEqual([0, 0, 0]);
});

fnTest(["M03.F03.I01"], "rebar-welding：parseBendRecord 默认 90°+ 合格", () => {
  const b = parseBendRecord(undefined);
  expect(b.angles).toEqual([90, 90, 90]);
  expect(b.results).toEqual(["合格", "合格", "合格"]);
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

/** 建卡：signal inputs 逐个 setInput（ParamCardBase 九键全量），返回 el。 */
function makeCard(
  component: Type<ParamCardBase>,
  over: { parameter?: InspectionParameter; readOnly?: boolean } = {},
): { el: HTMLElement; fixture: ComponentFixture<ParamCardBase> } {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [component],
    providers: [provideZonelessChangeDetection()],
  });
  const fixture = TestBed.createComponent(component);
  fixture.componentRef.setInput(
    "parameter",
    over.parameter ?? param("IP-0087", "抗拉强度"),
  );
  fixture.componentRef.setInput("record", undefined);
  fixture.componentRef.setInput("sampleId", "s1");
  fixture.componentRef.setInput("standards", []);
  fixture.componentRef.setInput("stdParams", []);
  fixture.componentRef.setInput("techReqs", []);
  fixture.componentRef.setInput("config", undefined);
  fixture.componentRef.setInput("readOnly", over.readOnly ?? false);
  fixture.componentRef.setInput("cardChange", () => {});
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, fixture };
}

const TENSILE_LOAD_SEL = 'input[aria-label^="试件"][aria-label$="最大荷重"]';
const BEND_ANGLE_SEL = 'input[aria-label^="试件"][aria-label$="弯曲角度"]';

fnTest(["M03.F03.I01"], "RebarWeldingTensileCard 渲染 3 行 + 共享规格 Φ22", () => {
  const { el } = makeCard(RebarWeldingTensileCardComponent);
  expect(el.textContent).toContain("Φ22");
  expect(el.querySelectorAll(TENSILE_LOAD_SEL).length).toBe(3);
});

fnTest(
  ["M03.F03.I02"],
  "RebarWeldingTensileCard 录入最大荷重 → 抗拉强度自动算出（只读）",
  () => {
    const { el, fixture } = makeCard(RebarWeldingTensileCardComponent);
    const input = el.querySelector<HTMLInputElement>(TENSILE_LOAD_SEL)!;
    fireEventInput(input, "100");
    fixture.detectChanges(); // zoneless：native 事件后手动 CD 刷 DOM
    // 100 kN → Rm = 4000·100/(π·22²) ≈ 263.16 → 圆整 0.1 → "263.1"
    expect(el.textContent).toContain("263.1");
  },
);

fnTest(["M03.F03.I01"], "RebarWeldingTensileCard readOnly：输入禁用", () => {
  const { el } = makeCard(RebarWeldingTensileCardComponent, { readOnly: true });
  const input = el.querySelector<HTMLInputElement>('input[aria-label="试件 1 最大荷重"]');
  expect(input?.readOnly).toBe(true);
});

fnTest(["M03.F03.I01"], "RebarWeldingBendCard 渲染 3 行弯曲角度 + 整体评定", () => {
  const { el } = makeCard(RebarWeldingBendCardComponent, {
    parameter: param("IP-0155", "弯曲性能"),
  });
  expect(el.querySelectorAll(BEND_ANGLE_SEL).length).toBe(3);
  expect(el.textContent).toContain("JGJ/T 27-2014");
});

fnTest(["M03.F03.I02"], "RebarWeldingBendCard 整体评定：3 件全合格 → 合格", () => {
  const { el } = makeCard(RebarWeldingBendCardComponent, {
    parameter: param("IP-0155", "弯曲性能"),
  });
  // 默认全合格 → 整体评定 span 显示「合格」（text-green-600 与 react 同名）
  expect(el.querySelector(".text-green-600")?.textContent).toBe("合格");
});

function fireEventInput(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
