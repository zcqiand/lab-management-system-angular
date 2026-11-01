import { defineConfig } from "orval";

// orval config (in angular 仓) — generates TS api-client from shared's OpenAPI.yaml.
//
// 架构照 lab-react 仓（REQ-2026-031 全量同步；tags-split 细节见彼处注释）与
// saas-angular 先例（REQ-2026-029）：
// - mode: "tags-split" — 按 shared tsp 的 @tag 拆成多文件，schemas 抽到 model/ 子目录
// - target: 目录（不是文件）—— orval tags-split 必须 dir，不能 file
// - client: "angular"（@orval/angular）—— 产 @Injectable 服务 + HttpClient + Observable，
//   替代 lab-react 仓的 react-query hooks；页面层 query 状态由 @tanstack/angular-query
//   包 generated 服务方法（queryKey 保持 orval op 名前缀形状，与 react 仓对齐）。
// - frontend-bind-meta 是 shared 仓的 emit-only 锚点（把 8 个契约 schema 拉进
//   components.schemas），后端不实现该端点 — exclude 掉，避免生成一个调用必
//   404 的 stub。8 个契约类型仍写进 model/，入口在 src/api/contracts.ts。
//   ⚠ orval 必须钉 7.21（= lab-react 同版）：v8 会把只被被 exclude 操作引用的
//   schema（AuthState/TokenStorageKeys 等）当孤儿清掉——2026-11-01 v8.46 实证，
//   降 7.21 后照常出 model/。
//
// 此文件 owned by angular 仓；其他前端（react / vue / nextjs）有自己独立副本。
export default defineConfig({
  lab: {
    input: {
      target: "../lab-management-system-shared/generated/openapi/openapi.yaml",
      filters: {
        mode: "exclude",
        tags: ["frontend-bind-meta"],
      },
    },
    output: {
      mode: "tags-split",
      target: "./src/api/endpoints",
      schemas: "./src/api/endpoints/model",
      // clean：生成前清空目标目录（2026-09-17 SSOT 清理）。整个 endpoints/
      // 目录 must stay orval-owned：手写文件一律放 src/api/ 下，不得混入。
      clean: ["./src/api/endpoints"],
      client: "angular",
      override: {
        useDates: false,
      },
    },
  },
});
