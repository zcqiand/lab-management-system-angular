// vitest.bridge.config.ts — unit-test builder 的 runnerConfig 桥（REQ-2026-031 T-L0，
// 移植自 saas-identity-platform-angular/vitest.bridge.config.ts）。
// angular.json test.runnerConfig 指向本文件：builder 把它并入自己生成的 vitest
// 配置（builder 独占 include/reporters/setupFiles，此处只补 builder 够不着的键）。
// 语义逐条对齐 lab-management-system-react/vitest.config.ts jsdom project 段：
//   - globalSetup：真链路五步基座（种子 → :5201 → 真 JWT → 探针 → 库身份）；
//   - fileParallelism:false —— 共享真后端 + 真库 = 共享可变状态，文件必须串行
//     （saas-angular 同款裁定：并行下写测试与种子锚并发 → 瞬态假红）；
//   - testTimeout:30000 —— 真链路 jsdom 测试吃真 nextjs dev 冷编译（单路由
//     10-20s 常态），默认 10s 恒误报；
//   - jsdom url 与真后端 :5201 同源——jsdom 的 XHR 对跨源响应按网络错误处理
//     （react T7 实测：url≠5201 时 dom 测试全挂）。
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    environmentOptions: { jsdom: { url: "http://localhost:5201" } },
  },
});
