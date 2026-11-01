// 路由表 — 对应 react 仓 App.tsx 的 <Routes>（REQ-2026-031）。
// L-T0：/login + AppShell（守卫在 canActivate）+ index/dashboard 占位 + 兜底
// BadPathRedirect。业务页随 L-T1..L-T4 逐批真实现，路径坑位先占齐（react
// Sprint 2 同款策略：route 已占坑，侧栏点进去不 404）。
import { Routes } from "@angular/router";
import { AppShell } from "./app-shell/app-shell";
import { BadPathRedirectComponent } from "./app-shell/bad-path-redirect";
import { authGuard } from "./auth.guard";
import { DashboardPageComponent } from "./pages/dashboard-page";
import { LoginPageComponent } from "./pages/login-page";

export const routes: Routes = [
  // Login: 独立布局（SSO orchestrator，不带 AppShell）
  { path: "login", component: LoginPageComponent },

  // 业务页全部包 AppShell（sidebar + header + content），守卫在壳层
  {
    path: "",
    canActivate: [authGuard],
    component: AppShell,
    children: [
      { path: "", component: DashboardPageComponent, pathMatch: "full" },
      // V016 菜单路径对齐：saas 仪表盘 path=dashboard（m-lab-dash）。
      // legacy 路径 `/` 保留，两路由同渲染 DashboardPage。
      { path: "dashboard", component: DashboardPageComponent },
      // L-T1..L-T4 业务页按批接线（models / specifications / ... / summary）
    ],
  },

  // 兜底 404 / bad-path：react 的 `*` 在顶层（不带 AppShell）——/undefined 等
  // saas 模板残渣在无壳层时静默 navigate "/"，真 404 全屏渲染。
  { path: "**", component: BadPathRedirectComponent },
];
