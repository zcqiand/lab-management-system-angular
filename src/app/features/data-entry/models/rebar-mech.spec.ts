// rebarMechanics 算法 + RebarMechNumericCard 单测
//（REQ-2026-031 L-T3③，移植自 lab-management-system-react
// tests/features/data-entry/rebarMech.dom.test.tsx，断言 1:1）。
// 通用多组数值卡：formulaKey 决定行为（tensile/yield/passthrough/ratio_*）。
import { Type } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideZonelessChangeDetection } from "@angular/core";
import type { ComponentFixture } from "@angular/core/testing";
import { describe, expect, vi } from "vitest";

import { fnTest } from "../../../../../tests/fn";
import {
  computeStrengths,
  ratioTensileOverYield,
  ratioMeasuredOverSpec,
  meanOf,
  rounderFor,
} from "./rebar-mechanics";
import { RebarMechNumericCardComponent } from "./rebar-mech-numeric-card";
import type { ParamCardBase } from "./param-card-base";
import type { ParamCardPatch } from "./types";
import type { InspectionParameter } from "../../../../api/endpoints/model/inspectionParameter";

vi.setConfig({ testTimeout: 90_000 });

fnTest(
  ["M03.F03.I01"],
  "rebar-mechanics：tensile_strength 算子（R = 4000·F/(π·d²)）",
  () => {
    // d=22, F=[100,110] → [263.2, 289.5] MPa
    const s = computeStrengths([100, 110], 22);
    expect(s[0]).toBeCloseTo(263.2, 0);
    expect(s[1]).toBeCloseTo(289.5, 0);
  },
);

fnTest(["M03.F03.I01"], "rebar-mechanics：强屈比 ratioTensileOverYield", () => {
  const t = [540, 560]; // 抗拉
  const y = [400, 420]; // 屈服
  const r = ratioTensileOverYield(t, y, 2);
  expect(r[0]).toBeCloseTo(1.35, 1);
  expect(r[1]).toBeCloseTo(1.33, 1);
});

fnTest(["M03.F03.I01"], "rebar-mechanics：超强比 ratioMeasuredOverSpec", () => {
  // 实测屈服 [440, 450]，标准屈服 400 → [1.10, 1.13]
  const r = ratioMeasuredOverSpec([440, 450], 400, 2);
  expect(r[0]).toBeCloseTo(1.1, 1);
  expect(r[1]).toBeCloseTo(1.13, 1);
});

fnTest(["M03.F03.I01"], "rebar-mechanics：meanOf 算术平均", () => {
  const round = rounderFor("tensile_strength");
  expect(meanOf([50, 60, 70], round)).toBe(60);
  expect(meanOf([0, 0, 0], round)).toBeUndefined();
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

const TENSILE_CFG = {
  formulaKey: "tensile_strength",
  specimenCount: 2,
  needsDiameter: true,
};

/** 建卡：signal inputs 逐个 setInput（ParamCardBase 九键 + 本卡 calcRule/crossRecord）。 */
function makeCard(
  component: Type<ParamCardBase>,
  over: {
    parameter?: InspectionParameter;
    config?: Record<string, unknown>;
    readOnly?: boolean;
  } = {},
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
  fixture.componentRef.setInput("config", over.config ?? TENSILE_CFG);
  fixture.componentRef.setInput("readOnly", over.readOnly ?? false);
  fixture.componentRef.setInput("cardChange", (_p: ParamCardPatch) => {});
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, fixture };
}

const LOAD_SEL = 'input[aria-label^="第"][aria-label$="组 数值"]';

fnTest(
  ["M03.F03.I01"],
  "RebarMechNumericCard tensile_strength：2 组 + 公称直径输入",
  () => {
    const { el } = makeCard(RebarMechNumericCardComponent);
    expect(el.querySelectorAll(LOAD_SEL).length).toBe(2);
    expect(el.querySelector('input[aria-label="公称直径"]')).toBeTruthy();
  },
);

fnTest(
  ["M03.F03.I02"],
  "RebarMechNumericCard 录入最大力 + 直径 → 强度 + 均值上屏",
  () => {
    const { el, fixture } = makeCard(RebarMechNumericCardComponent);
    const dia = el.querySelector<HTMLInputElement>('input[aria-label="公称直径"]')!;
    const inputs = el.querySelectorAll<HTMLInputElement>(LOAD_SEL);
    fireEventInput(dia, "22");
    fireEventInput(inputs[0]!, "100");
    fixture.detectChanges(); // zoneless：native 事件后手动 CD 刷 DOM
    expect(el.textContent).toContain("263.1");
  },
);

fnTest(["M03.F03.I01"], "RebarMechNumericCard readOnly：禁用输入", () => {
  const { el } = makeCard(RebarMechNumericCardComponent, { readOnly: true });
  const input = el.querySelector<HTMLInputElement>('input[aria-label="公称直径"]')!;
  expect(input.readOnly).toBe(true);
});

function fireEventInput(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
