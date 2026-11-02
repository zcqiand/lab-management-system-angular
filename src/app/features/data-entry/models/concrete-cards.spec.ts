// 混凝土类模型卡（concrete-compress / concrete-permeability）单测
//（REQ-2026-031 L-T3③，移植自 lab-management-system-react
// tests/features/data-entry/concreteCards.dom.test.tsx，断言 1:1）。
import { Type } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideZonelessChangeDetection } from "@angular/core";
import { fireEvent } from "@testing-library/dom";
import { describe, expect, vi } from "vitest";

import { fnTest } from "../../../../../tests/fn";
import { ConcreteCompressCardComponent } from "./concrete-compress-card";
import { ConcretePermeabilityCardComponent } from "./concrete-permeability-card";
import type { ParamCardBase } from "./param-card-base";
import type { ParamCardPatch } from "./types";
import type { InspectionParameter } from "../../../../api/endpoints/model/inspectionParameter";

vi.setConfig({ testTimeout: 90_000 });

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

/** 建卡：signal inputs 逐个 setInput（ParamCardBase 九键全量），返回 fixture + 收集的补丁。 */
function makeCard(
  component: Type<ParamCardBase>,
  over: { parameter?: InspectionParameter; readOnly?: boolean } = {},
): { el: HTMLElement; patches: ParamCardPatch[] } {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [component],
    providers: [provideZonelessChangeDetection()],
  });
  const fixture = TestBed.createComponent(component);
  fixture.componentRef.setInput(
    "parameter",
    over.parameter ?? param("IP-0055", "立方体抗压强度"),
  );
  fixture.componentRef.setInput("record", undefined);
  fixture.componentRef.setInput("sampleId", "s1");
  fixture.componentRef.setInput("standards", []);
  fixture.componentRef.setInput("stdParams", []);
  fixture.componentRef.setInput("techReqs", []);
  fixture.componentRef.setInput("config", undefined);
  fixture.componentRef.setInput("readOnly", over.readOnly ?? false);
  const patches: ParamCardPatch[] = [];
  fixture.componentRef.setInput("cardChange", (p: ParamCardPatch) => patches.push(p));
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, patches };
}

const LOAD_INPUT_SEL = 'input[type="number"][placeholder="破坏荷载 (kN)"]';

describe("ConcreteCompressCard", () => {
  fnTest(
    ["M03.F03.I01"],
    "ConcreteCompressCard 渲染 3 个破坏荷载输入框（specimenCount=3）",
    () => {
      const { el } = makeCard(ConcreteCompressCardComponent);
      expect(el.querySelectorAll(LOAD_INPUT_SEL).length).toBe(3);
    },
  );

  fnTest(
    ["M03.F03.I02"],
    "ConcreteCompressCard 录入荷载 → onChange 上报代表值 JSON",
    () => {
      const { el, patches } = makeCard(ConcreteCompressCardComponent);
      const inputs = el.querySelectorAll<HTMLInputElement>(LOAD_INPUT_SEL);
      fireEvent.input(inputs[0]!, { target: { value: "450" } });
      fireEvent.input(inputs[1]!, { target: { value: "450" } });
      fireEvent.input(inputs[2]!, { target: { value: "450" } });
      const last = patches.at(-1)!;
      const parsed = JSON.parse(last.result ?? "{}") as {
        loads: number[];
        representative: number;
      };
      expect(parsed.loads).toEqual([450, 450, 450]);
      expect(parsed.representative).toBeCloseTo(20, 0); // 450000/22500 = 20 MPa
    },
  );

  fnTest(["M03.F03.I01"], "ConcreteCompressCard readOnly：输入吞掉 onChange", () => {
    const { el, patches } = makeCard(ConcreteCompressCardComponent, { readOnly: true });
    const input = el.querySelector<HTMLInputElement>(LOAD_INPUT_SEL)!;
    fireEvent.input(input, { target: { value: "500" } });
    expect(patches.length).toBe(0);
  });
});

describe("ConcretePermeabilityCard", () => {
  fnTest(
    ["M03.F03.I01"],
    "ConcretePermeabilityCard 渲染 6 个试件行（specimenCount=6）",
    () => {
      const { el } = makeCard(ConcretePermeabilityCardComponent, {
        parameter: param("IP-0190", "抗渗性能"),
      });
      expect(
        el.querySelectorAll('input[aria-label^="试件"][aria-label$="渗水压力"]').length,
      ).toBe(6);
    },
  );

  fnTest(
    ["M03.F03.I02"],
    "ConcretePermeabilityCard 6 件全未渗 → 抗渗等级显示「—」",
    () => {
      const { el } = makeCard(ConcretePermeabilityCardComponent, {
        parameter: param("IP-0190", "抗渗性能"),
      });
      expect(el.textContent).toContain("—");
    },
  );

  fnTest(["M03.F03.I01"], "ConcretePermeabilityCard readOnly：禁用输入", () => {
    const { el } = makeCard(ConcretePermeabilityCardComponent, {
      parameter: param("IP-0190", "抗渗性能"),
      readOnly: true,
    });
    const input = el.querySelector<HTMLInputElement>(
      'input[aria-label="试件 1 渗水压力"]',
    );
    expect(input?.readOnly).toBe(true);
  });
});
