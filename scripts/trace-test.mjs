// trace wrapper（go scripts/harness_trace.py 的「新建仓不假红」同款）：
//   - node_modules 未装 → 产空 trace.json 退出 0。新建仓 L5 不因「依赖没装」exit 2，
//     装完依赖后自动切真跑（FnReporter 落真 trace）。
//   - 已装 → 子进程跑 `ng test`（angular.json unit-test builder reporters 已挂
//     tests/fnReporter.mjs），TRACE_MAP=1 由 gate 的 trace_env 注入，reporter 落 trace。
// 注意：L4 测试门不走本 wrapper（profile 里 L4 = npx --no ng test 直跑），
//       否则无依赖时 L4 会被空 trace 假绿 —— wrapper 只服务 trace_cmd。
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

const ngBin =
  process.platform === "win32" ? "node_modules/.bin/ng.cmd" : "node_modules/.bin/ng";

if (!existsSync(ngBin)) {
  mkdirSync(".state", { recursive: true });
  writeFileSync(".state/trace.json", JSON.stringify({ schema: 1, tests: [] }, null, 2) + "\n");
  console.log(
    "[trace-test] node_modules 未安装，产空 trace 退出 0（go 栈同款；npm install 后自动切真跑）",
  );
  process.exit(0);
}

const res = spawnSync(ngBin, ["test"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});
process.exit(res.status ?? 1);
