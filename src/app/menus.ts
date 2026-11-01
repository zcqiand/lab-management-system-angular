// 静态本地菜单树 — 移植自 lab-management-system-react/src/components/app/menus.ts
//（REQ-2026-031）。
//
// react 仓侧栏数据源是 lab 后端 /api/auth/menus（demo 兜底 2026-08-27 删除，
// miss 503 上抛错误）；本文件保留 APP_CODE / APP_NAME 常量（AppShell 品牌头用）
// 与 MENU_TREE 静态树（MenuNode 形状与后端契约 MenuNode 对齐，供测试锚与
// 跨仓对齐参考）。code 沿用 saas 菜单码（m-*），供 data-fn 锚点（m-<code>）。

export const APP_CODE = "lab-management";

export const APP_NAME = "建筑工程实验室管理系统";
