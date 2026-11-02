// cementStrength 算法 + CementCompressCard / CementFlexuralCard 单测
//（REQ-2026-031 L-T3③，移植自 lab-management-system-react
// tests/features/data-entry/cementStrength.dom.test.tsx，断言 1:1）。
// GB/T 17671：Rf=1.5·F·L/b³（40×40×160mm），Rc=F/A（受压面 40×40mm）。
// ±10% 剔除：均值基线，离群超 ±10% 剔除；超 1 个离群即整组作废。
import { Type } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideZonelessChangeDetection } from "@angular/core";
import { fireEvent } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";

import { fnTest } from "../../../../../tests/fn";
import {
  flexuralStrength,
  compressStrength,
  reduceStrengths,
  computeCementFlexural,
  computeCementCompress,
  autoVerdict,
  parseStrengthRecord,
} from "./cement-strength";
import { CementCompressCardComponent } from "./cement-compress-card";
import { CementFlexuralCardComponent } from "./cement-flexural-card";
import type { ParamCardBase } from "./param-card-base";
import type { ParamCardPatch } from "./types";
import type { InspectionParameter } from "../../../../api/endpoints/model/inspectionParameter";
import type { TechnicalRequirement } from "../../../../api/endpoints/model/technicalRequirement";

vi.setConfig({ testTimeout: 90_000 });

fnTest(["M03.F03.I01"], "水泥胶砂强度：抗折 Rf=1.5·F·L/b³（2kN → 4.7 MPa）", () => {
  expect(flexuralStrength(2)).toBe(4.7);
  expect(flexuralStrength(0)).toBe(0);
});

fnTest(
  ["M03.F03.I01"],
  "水泥胶砂强度：抗压 Rc=F/A（16kN → 10.0；80kN → 50.0 MPa）",
  () => {
    expect(compressStrength(16)).toBe(10);
    expect(compressStrength(80)).toBe(50);
  },
);

describe("reduceStrengths ±10% 剔除", () => {
  it("全部一致 → 无剔除、均值即该值、有效", () => {
    const r = reduceStrengths([50, 50, 50, 50, 50, 50]);
    expect(r.mean).toBe(50);
    expect(r.invalid).toBe(false);
    expect(r.kept.every(Boolean)).toBe(true);
  });

  it("单个离群值被剔除、均值取剩余、仍有效", () => {
    // 30 超出 6 值均值(46.67)的 ±10%(±4.67) → 剔除，剩 5×50 → 50
    const r = reduceStrengths([30, 50, 50, 50, 50, 50]);
    expect(r.mean).toBe(50);
    expect(r.invalid).toBe(false);
    expect(r.kept).toEqual([false, true, true, true, true, true]);
  });

  it("多于一个离群 → 作废 invalid=true（仍给出幸存均值）", () => {
    const r = reduceStrengths([30, 50, 50, 50, 50, 70]);
    expect(r.invalid).toBe(true);
    expect(r.mean).toBe(50);
    expect(r.kept).toEqual([false, true, true, true, true, false]);
  });

  it("无有效荷载 → 均值 undefined、非作废", () => {
    const r = reduceStrengths([0, 0, 0]);
    expect(r.mean).toBeUndefined();
    expect(r.invalid).toBe(false);
  });
});

describe("computeCementFlexural / computeCementCompress", () => {
  it("抗折 3 荷载 → 3 强度 + 均值", () => {
    const r = computeCementFlexural([2, 2, 2]);
    expect(r.strengths).toEqual([4.7, 4.7, 4.7]);
    expect(r.mean).toBe(4.7);
  });

  it("抗压 6 荷载 → 6 强度 + 均值；缺失项记 0/false", () => {
    const r = computeCementCompress([80, 80, 80, 80, 80, 0]);
    expect(r.strengths).toEqual([50, 50, 50, 50, 50, 0]);
    expect(r.mean).toBe(50);
    expect(r.kept[5]).toBe(false);
  });
});

describe("autoVerdict 均值 vs 技术要求", () => {
  const req = (over: Partial<TechnicalRequirement>): TechnicalRequirement =>
    ({
      tenantId: "TENANT-TEST",
      inspectionObjectCode: "OBJ-SP01-P1",
      inspectionParameterCode: "IP-0556",
      judgmentStandardCode: "GB 175-2023",
      valueType: "numeric",
      comparison: "≥",
      minValue: 17,
      judgmentMode: "automatic",
      verificationStatus: "verified",
      sortOrder: 1,
      createdAt: "",
      updatedAt: "",
      ...over,
    }) as TechnicalRequirement;

  it("≥：均值达标→合格，不达标→不合格", () => {
    expect(autoVerdict(20, req({}))).toBe("合格");
    expect(autoVerdict(15, req({}))).toBe("不合格");
  });

  it("无均值或无要求 → 空（无法判定）", () => {
    expect(autoVerdict(undefined, req({}))).toBe("");
    expect(autoVerdict(20, undefined)).toBe("");
  });
});

describe("parseStrengthRecord", () => {
  it("反解析 loads/strengths/mean；坏 JSON 兜底空", () => {
    const p = parseStrengthRecord(
      JSON.stringify({ loads: [1, 2], strengths: [0.6, 1.3], mean: 1 }),
    );
    expect(p.loads).toEqual([1, 2]);
    expect(p.mean).toBe(1);
    expect(parseStrengthRecord("{bad").loads).toEqual([]);
    expect(parseStrengthRecord(undefined).strengths).toEqual([]);
  });
});

// ---- 卡片渲染（react render+fireEvent → TestBed setInput+fireEvent）----

const param = (code: string, name: string): InspectionParameter =>
  ({
    code,
    name,
    rawName: name,
    canonicalName: name,
    aliases: [],
    unit: "MPa",
    sourceType: "official",
    sortOrder: 1,
    createdAt: "",
    updatedAt: "",
  }) as InspectionParameter;

const verifiedReq: TechnicalRequirement = {
  tenantId: "TENANT-TEST",
  inspectionObjectCode: "OBJ-SP01-P1",
  inspectionParameterCode: "IP-0556",
  judgmentStandardCode: "GB 175-2023",
  valueType: "numeric",
  comparison: "≥",
  minValue: 17,
  judgmentMode: "automatic",
  verificationStatus: "verified",
  sortOrder: 1,
  createdAt: "",
  updatedAt: "",
};

/** 建卡：signal inputs 逐个 setInput（ParamCardBase 九键全量），返回 fixture + 收集的补丁。 */
function makeCard(
  component: Type<ParamCardBase>,
  over: {
    parameter?: InspectionParameter;
    techReqs?: TechnicalRequirement[];
    readOnly?: boolean;
  } = {},
): { el: HTMLElement; patches: ParamCardPatch[] } {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [component],
    providers: [provideZonelessChangeDetection()],
  });
  const fixture = TestBed.createComponent(component);
  fixture.componentRef.setInput(
    "parameter",
    over.parameter ?? param("IP-0556", "3 天抗压强度"),
  );
  fixture.componentRef.setInput("record", undefined);
  fixture.componentRef.setInput("sampleId", "s1");
  fixture.componentRef.setInput("standards", []);
  fixture.componentRef.setInput("stdParams", []);
  fixture.componentRef.setInput("techReqs", over.techReqs ?? []);
  fixture.componentRef.setInput("config", undefined);
  fixture.componentRef.setInput("readOnly", over.readOnly ?? false);
  const patches: ParamCardPatch[] = [];
  fixture.componentRef.setInput("cardChange", (p: ParamCardPatch) => patches.push(p));
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, patches };
}

const LOAD_INPUT_SEL = 'input[type="number"][placeholder="破坏荷载 (kN)"]';

function fillLoads(el: HTMLElement, value: string): void {
  const inputs = el.querySelectorAll<HTMLInputElement>(LOAD_INPUT_SEL);
  inputs.forEach((input) => fireEvent.input(input, { target: { value } }));
}

fnTest(["M03.F03.I01"], "CementCompressCard 渲染 6 个破坏荷载输入框", () => {
  const { el } = makeCard(CementCompressCardComponent);
  expect(el.querySelectorAll(LOAD_INPUT_SEL).length).toBe(6);
});

fnTest(
  ["M03.F03.I02"],
  "CementCompressCard 有技术要求：录入均值达标 → 自动判合格",
  () => {
    const { el, patches } = makeCard(CementCompressCardComponent, {
      techReqs: [verifiedReq],
    });
    fillLoads(el, "80"); // → 50 MPa ≥ 17
    const last = patches.at(-1)!;
    expect(last.verdict).toBe("合格");
    // 契约实体无 id：requirementCode 现在是复合键 techReqKey（判定标准|品牌|型号|等级|规格）
    expect(last.requirementCode).toBe("GB 175-2023||||");
  },
);

fnTest(["M03.F03.I03"], "CementCompressCard 无技术要求：回退手选单项评定", () => {
  const { el } = makeCard(CementCompressCardComponent, { techReqs: [] });
  expect(el.textContent).toContain("单项评定");
});

fnTest(["M03.F03.I01"], "CementCompressCard readOnly：输入吞掉 onChange", () => {
  const { el, patches } = makeCard(CementCompressCardComponent, {
    techReqs: [verifiedReq],
    readOnly: true,
  });
  const input = el.querySelector<HTMLInputElement>(LOAD_INPUT_SEL)!;
  fireEvent.input(input, { target: { value: "80" } });
  expect(patches.length).toBe(0);
});

fnTest(["M03.F03.I01"], "CementFlexuralCard 渲染 3 个破坏荷载 + 抗折强度列", () => {
  const { el } = makeCard(CementFlexuralCardComponent, {
    parameter: param("IP-0555", "3 天抗折强度"),
  });
  expect(el.querySelectorAll(LOAD_INPUT_SEL).length).toBe(3);
  expect(el.textContent).toContain("抗折强度 (MPa)");
});
