# REQ-2026-031 lab Angular 前端全功能同步（移植 lab-react 24 页）

| 项 | 值 |
|---|---|
| 提出人 | zcqiand |
| 提出日期 | 2026-11-01 |
| 优先级 | P1 |
| 状态 | 开发中 |
| 关联 REQ | saas 侧先例 REQ-2026-029（saas-angular 全量同步，已 GA）；lab-react 侧 REQ-2026-017/019/023 等 |

## 1. 需求描述

参考 `lab-management-system-react`，把全部前端功能 1:1 移植进 `lab-management-system-angular`（用户 2026-11-01「继续」拍板，承接 saas-angular 同款决策）：

- **UI 底座 = Angular Material**（同 saas-angular 人裁）。
- **测试链 = 真化**（同 saas-angular 人裁）：global-setup 灌 `lab_test` 种子 + 起真 lab-nextjs `:5201`（已健康则复用）+ 铸真 JWT + 探活；gate L4 注入 `DATABASE_URL` 走 `L4_DB_INJECT_REPOS` 表（**2026-11-01 人裁批准入表**）。
- 范围 = lab-react 24 页 + 登录 + AppShell + 路由守卫；功能树 I 级子项随切片 mirror 登记（骨架批只铺到 F 级）。

### 澄清记录

| 疑问 | 澄清结论 | 澄清人 | 日期 |
|---|---|---|---|
| L4_DB_INJECT_REPOS 入表 | 批准（改门禁语义人裁通道，账本=scripts/lib/harness.py 表内注释） | zcqiand | 2026-11-01 |
| UI 底座 / 测试链 | 沿用 saas-angular 批人裁：Material / 真化 | zcqiand | 2026-11-01 |

## 2. 验收标准

| 编号 | 场景（给定） | 操作（当） | 预期（则） |
|---|---|---|---|
| AC-1 | 全部切片落地 | `python scripts/gate.py -p lab-management-system-angular` | exit 0 |
| AC-2 | 测试真化 | global-setup 五步（种子→:5201→JWT→验签→探活） | fail-fast 无 mock 降级 |
| AC-3 | API 面 | 对照 shared 契约生成物 | 100% orval 产物，无手写端点 |
| AC-4 | 功能覆盖 | 对照 lab-react 页面清单 | 24 页 + 登录 + 壳层全接线，data-fn 锚随组件走 |
| AC-5 | 树状态 | tree_change mirror 通道 | 已实现 F/I 逐批推进（规划→开发中；GA 待人工验收记录） |

## 3. 任务拆解

| 任务 ID | 任务描述 | 类型 | 负责人 | 预估 | 状态 |
|---|---|---|---|---|---|
| L-T0 | 基建：harness.py 入表（人裁已批）+ deps（Material/CDK/angular-query/orval/jose/testing-library）+ orval 出 endpoints/ + 真化测试桥（vitest.bridge.config.ts + tests/global-setup.ts lab 变体 + helpers）+ HTTP 拦截器 + auth/session signals + 路由 + AppShell + 登录页 | 开发 | Claude | — | 开发中 |
| L-T1 | 字典页批（M06.F01-F08：检测专项/项目/参数/标准/计算方法/技术要求/报告名称/参数界面 8 页） | 开发 | Claude | — | 待开始 |
| L-T2 | 码表页批（M04.F06-F09：型号/规格/等级/牌号 4 页）+ 合同页（M02.F01） | 开发 | Claude | — | 待开始 |
| L-T3 | 接样流批（M03.F01-F03/F09：接样/任务分配/数据录入/接样单详情） | 开发 | Claude | — | 待开始 |
| L-T4 | 报告流批（M03.F05-F08 + M05.F01：审核/批准/发放/归档/汇总）+ 认证域（M00.F01/F02、M01.F04/F05 壳层接线回归） | 开发 | Claude | — | 待开始 |
| L-T5 | 收官：树状态推进（mirror 免批通道）+ gate 全绿 + handoff | 收口 | Claude | — | 待开始 |

## 4. 功能影响（需求与功能对齐的唯一位置）

| 功能 ID | 功能名称 | 影响类型 | 说明 | 关联任务 |
|---|---|---|---|---|
| M00.F01/F02, M01.F04/F05 | 认证域 4F | 变更 | 状态随实现推进（I 级随切片 mirror 登记） | L-T0/L-T4 |
| M02.F01, M03.F01-F09, M04.F06-F09, M05.F01, M06.F01-F08 | 业务域 22F | 变更 | 同上 | L-T1..L-T4 |

## 5. 流程影响

无（前端移植，不改后端流程）。

## 6. 风险与回滚

| 风险 | 影响面 | 缓解 | 回滚方式 |
|---|---|---|---|
| zoneless+jsdom 指纹（saas 批九坑在册） | 页面测试 | 复用 saas-angular tests/helpers 配方（TestHost/native input/信号/mat-checkbox 内层 input） | 逐页独立 commit 可回退 |
| lab-nextjs 探活/复用治理 | L4 | 沿 lab-react global-setup 进程治理裁定（留活不杀、PID 落 tmp） | global-setup fail-fast 显式报错 |
| angular builder 双执行踩共享库 | 写路径用例 | API 自建随机后缀 fixture + afterEach 真删除清理（saas 批实证） | 同上 |
| orval 生成物与 shared 漂移 | AC-3 | L4.codegen.idempotent 门兜底 | gen-shared 重跑 |
