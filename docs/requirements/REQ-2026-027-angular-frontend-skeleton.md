# REQ-2026-027 lab Angular 前端骨架进家族（X15 槽）

| 项 | 值 | 
|---|---|
| 提出人 | zcqiand |
| 提出日期 | 2026-10-31 |
| 优先级 | P1 |
| 状态 | 完成（2026-10-31 首航收官：Node 24.15.0 + L0-L5 全绿，AC-1..4 全过） |
| 关联 ADR | —（扩展槽骨架，ktor X09 / harmonyos X14 先例同款） |

## 1. 需求描述

lab 家族 X15 扩展槽：Angular 22 前端栈进家族。suite 侧新增 mold/profiles/angular.toml + mold/adapters/angular/（react-ts 同款 fnTest/FnReporter trace 机制 + go 同款新建仓 L5 不假红 wrapper），init 出 `lab-management-system-angular`（5212 端口段预留，Phase 1 无 dev server 部署面）。

功能树以镜像登记方式从家族 shared 全树同步 M/F 级骨架（ADR-0042 mirror 免批通道，REQ-2026-027 提案锚点）；I 级子项不预铺，留待首个业务需求逐片镜像登记（harmonyos X14 先例同款）。

### 澄清记录

| 疑问 | 澄清结论 | 澄清人 | 日期 |
|---|---|---|---|
| 技术栈版本 | Angular 22（当前稳定 22.2.x；TypeScript ~6.0 为 @angular/build peer 硬约束；Vitest 4 为默认 runner） | zcqiand | 2026-10-31 |
| 目录名 / 中文名 | 家族名-angular 后缀 / 「lab管理系统 Angular」 | zcqiand | 2026-10-31 |
| 功能树来源 | 镜像家族 shared 全树（M/F 级），不手拆独立树 | zcqiand | 2026-10-31 |

## 2. 验收标准

| 编号 | 场景（给定） | 操作（当） | 预期（则） |
|---|---|---|---|
| AC-1 | 仓已 init | `python scripts/gate.py -p lab-management-system-angular --only L0` | exit 0 |
| AC-2 | 仓已 init（无 node_modules） | `python scripts/gate.py -p lab-management-system-angular --only L5` | exit 0（wrapper 产空 trace 不假红） |
| AC-3 | 功能树 | 对比 lab-management-system-shared 树 | M/F 级逐条同源，消费仓状态一律 规划 |
| AC-4 | Node ≥24.15 后 `npm install`（npmmirror） | `python scripts/gate.py -p lab-management-system-angular` | L1-L4 全绿（prettier/eslint/ng build/ng test） |

## 3. 任务拆解

| 任务 ID | 任务描述 | 类型 | 负责人 | 预估 | 状态 |
|---|---|---|---|---|---|
| T-1 | mold 建 angular profile + 适配器 + 双仓 init + L0/L5 绿 | 开发 | Claude | 0.5h | 已完成 |
| T-2 | 功能树镜像登记（mirror 免批，M/F 级） | 开发 | Claude | 0.2h | 已完成 |
| T-3 | Node 升版 → npm install → L1-L4 全绿首航 → 家族档案/端口表收口 | 收口 | Claude | 0.5h | 已完成（2026-10-31，首航四坑修于 mold：eslint flat config 形状/tsconfig compilerOptions 层级/wrapper 反斜杠/fnReporter 格式；npx `--` 分隔随 X16 批） |

## 4. 功能影响（需求与功能对齐的唯一位置）

| 功能 ID | 功能名称 | 影响类型 | 说明 | 关联任务 |
|---|---|---|---|---|
| M00-M06 全部 F 级 | 镜像登记 | 新增 | 26 F 镜像自 shared BASE，状态 规划，无代码无测试 | T-2 |

## 5. 流程影响

无（纯骨架仓，flow/design 对齐表尚未建立）。

## 6. 风险与回滚

| 风险 | 影响面 | 缓解 | 回滚方式 |
|---|---|---|---|
| Node engines 硬约束（≥24.15） | npm install EBADENGINE / ng 拒跑 | 先升 Node 再 install；机器走 nvm4w | 回退 Node 版本即回现状 |
| 适配器首航风险（reporter 路径 / vitest alias） | L4 红 | 风险点已在 mold sync_always，--sync 可刷新；首航红了按 systematic-debugging 收口 | 修 mold 后 --sync 双仓 |
