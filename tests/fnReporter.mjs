import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// react-ts 栈 tests/fnReporter.ts 的 .mjs 移植。
// reporter 由 vitest 以裸 import() 加载（不经 vite-node 转换管线），必须自给自足的纯 JS。
// 逻辑与 react-ts 版保持逐句同构，改这边先读那边。

function emit(tests) {
  const out = ".state/trace.json";
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ schema: 1, tests }, null, 2) + "\n");
}

function clean(fns, inert) {
  if (inert || !Array.isArray(fns)) return [];
  return [...new Set(fns.map(String))].sort();
}

/**
 * vitest 适配器：把 fnTest 的标记落成 suite 契约的 .state/trace.json。
 *
 * 同时实现 v2 的 onFinished 与 v3+ 的 onTestRunEnd。vitest 只会调用它认识的那个。
 * 版本耦合是适配器的活，不该泄漏到 suite 或项目里。
 *
 * 契约：inert=true 的测试，fns 必须为空数组。
 * 被 skip 的测试不会执行，meta 永远写不进去 —— 假绿在物理上不可能。
 */
export default class FnReporter {
  /** vitest >= 3 */
  onTestRunEnd(testModules) {
    if (process.env.TRACE_MAP !== "1") return;
    const tests = [];
    for (const mod of testModules) {
      for (const t of mod.children.allTests()) {
        const inert = t.result().state === "skipped";
        tests.push({
          test: `${mod.moduleId}::${t.name}`,
          fns: clean(t.meta().fn, inert),
          inert,
        });
      }
    }
    emit(tests);
  }

  /** vitest 2 */
  onFinished(files = []) {
    if (process.env.TRACE_MAP !== "1") return;
    if (typeof this.onTestRunEnd === "function" && files.length === 0) {
      return; // v3+ 已经在 onTestRunEnd 写过了
    }
    const tests = [];
    const walk = (task, filepath) => {
      if (task.type === "suite") {
        for (const child of task.tasks ?? []) walk(child, filepath);
        return;
      }
      const inert =
        task.mode === "skip" || task.mode === "todo" || task.result?.state === "skip";
      tests.push({
        test: `${filepath}::${task.name}`,
        fns: clean(task.meta?.fn, inert),
        inert,
      });
    };
    for (const f of files) for (const t of f.tasks) walk(t, f.filepath);
    emit(tests);
  }
}
