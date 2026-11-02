// ParticleGradationCard 单测（REQ-2026-031 L-T3③，移植自 lab-management-system-react
// tests/features/data-entry/particleGradation.dom.test.tsx，断言 1:1）。
// GB/T 14684 砂：7 筛孔（4.75→0.15 + 筛底）；GB/T 14685 碎卵石：12 筛孔。
import { Type } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideZonelessChangeDetection } from "@angular/core";
import type { ComponentFixture } from "@angular/core/testing";
import { expect, vi } from "vitest";

import { fnTest } from "../../../../../tests/fn";
import { ParticleGradationCardComponent } from "./particle-gradation-card";
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

/** 建卡：signal inputs 逐个 setInput（ParamCardBase 九键全量），返回 el。 */
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
    over.parameter ?? param("IP-0577", "颗粒级配"),
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

function fireEvent(
  el: HTMLElement,
  selector: string,
  type: "input" | "blur",
  value?: string,
): void {
  const node = el.querySelector<HTMLInputElement>(selector)!;
  if (value !== undefined) {
    node.value = value;
    node.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    node.dispatchEvent(new Event(type, { bubbles: true }));
  }
}

fnTest(["M03.F03.I01"], "ParticleGradationCard 渲染 2 样品 × 7 筛孔 + 平均行", () => {
  const { el } = makeCard(ParticleGradationCardComponent);
  expect(el.textContent).toContain("4.75mm");
  expect(el.textContent).toContain("筛底");
  expect(el.textContent).toContain("平均值(%):");
});

fnTest(["M03.F03.I01"], "ParticleGradationCard gravel=true 切换到 12 筛孔", () => {
  const { el } = makeCard(ParticleGradationCardComponent, {
    config: { gravel: true },
  });
  expect(el.textContent).toContain("90mm");
  expect(el.textContent).toContain("2.36mm");
});

fnTest(
  ["M03.F03.I02"],
  "ParticleGradationCard 录入分计筛余 → onChange 上报累计筛余 JSON",
  () => {
    const { el, patches } = makeCard(ParticleGradationCardComponent);
    const sel = 'input[aria-label="第 1 行 4.75mm 分计筛余"]';
    fireEvent(el, sel, "input", "5");
    fireEvent(el, sel, "blur");
    expect(patches.length).toBeGreaterThan(0);
    const parsed = JSON.parse(patches.at(-1)!.result ?? "{}") as {
      rows: Array<{ retainedPct: number[]; cumulativePct: number[] }>;
    };
    expect(parsed.rows[0]!.retainedPct[0]).toBe(5);
    expect(parsed.rows[0]!.cumulativePct[0]).toBe(5);
  },
);

fnTest(["M03.F03.I01"], "ParticleGradationCard readOnly：禁用输入", () => {
  const { el } = makeCard(ParticleGradationCardComponent, { readOnly: true });
  const input = el.querySelector<HTMLInputElement>(
    'input[aria-label="第 1 行 4.75mm 分计筛余"]',
  )!;
  expect(input.readOnly).toBe(true);
});
