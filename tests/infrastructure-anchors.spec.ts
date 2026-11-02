// 接入点存在性 smoke（REQ-2026-031 L-T3③-tail，移植自 lab-management-system-react
// tests/infrastructure-anchors.test.ts）。
// ADR-0033 阶段二：M98 infra 段自 function-tree 退役，M98 锚点解挂为普通 it；
// M03.F01.I07 锚点保留。angular 侧差异：
// - BackendSwitcher 是 react 特有组件（angular 无此壳层件）→ 不设锚；
// - http-client 对应 angular 的 src/api/interceptors.ts（orval fetch mutator 层）。
import * as fs from "node:fs";
import * as path from "node:path";
import { expect, it } from "vitest";

import { fnTest } from "./fn";

const SRC = path.resolve(__dirname, "..");

it("axios interceptor module source file exists", () => {
  expect(fs.existsSync(path.join(SRC, "src/api/interceptors.ts"))).toBe(true);
});

it("orval-generated auth endpoint directory exists", () => {
  expect(fs.existsSync(path.join(SRC, "src/api/endpoints"))).toBe(true);
});

fnTest(["M03.F01.I07"], "SampleExtFieldsModal module source file exists", () => {
  expect(
    fs.existsSync(
      path.join(SRC, "src/app/features/data-entry/sample-ext-fields-modal.ts"),
    ),
  ).toBe(true);
});
