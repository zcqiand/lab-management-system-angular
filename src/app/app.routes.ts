// 路由表 — 对应 react 仓 App.tsx 的 <Routes>（REQ-2026-031）。
// L-T0：/login + AppShell（守卫在 canActivate）+ index/dashboard 占位 + 兜底
// BadPathRedirect。业务页随 L-T1..L-T4 逐批真实现，路径坑位先占齐（react
// Sprint 2 同款策略：route 已占坑，侧栏点进去不 404）。
import { Routes } from "@angular/router";
import { AppShell } from "./app-shell/app-shell";
import { BadPathRedirectComponent } from "./app-shell/bad-path-redirect";
import { authGuard } from "./auth.guard";
import { CalculationMethodsPageComponent } from "./pages/calculation-methods-page";
import { DashboardPageComponent } from "./pages/dashboard-page";
import { LoginPageComponent } from "./pages/login-page";
import { ObjectsPageComponent } from "./pages/objects-page";
import { ParamInterfacesPageComponent } from "./pages/param-interfaces-page";
import { ParametersPageComponent } from "./pages/parameters-page";
import { ReportNamesPageComponent } from "./pages/report-names-page";
import { SpecialtiesPageComponent } from "./pages/specialties-page";
import { StandardsPageComponent } from "./pages/standards-page";
import { TechnicalRequirementsPageComponent } from "./pages/technical-requirements-page";

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
      // L-T1 批①：M06 检测能力主表 4 页（react 同名路径 1:1）
      { path: "inspection-specialties", component: SpecialtiesPageComponent },
      { path: "inspection-standards", component: StandardsPageComponent },
      { path: "inspection-parameters", component: ParametersPageComponent },
      { path: "inspection-objects", component: ObjectsPageComponent },
      // L-T1 批②：M06.F05 计算方法 + M06.F06 技术要求（react 同名路径 1:1；
      // V016 菜单双路径：calculation-methods / calculation-rules 同渲染）
      {
        path: "inspection-calculation-methods",
        component: CalculationMethodsPageComponent,
      },
      {
        path: "inspection-calculation-rules",
        component: CalculationMethodsPageComponent,
      },
      {
        path: "inspection-technical-requirements",
        component: TechnicalRequirementsPageComponent,
      },
      // L-T1 批③：M06.F07 报告名称 + M06.F08 参数界面（react 同名路径 1:1）
      { path: "report-names", component: ReportNamesPageComponent },
      { path: "param-interfaces", component: ParamInterfacesPageComponent },
    ],
  },

  // 兜底 404 / bad-path：react 的 `*` 在顶层（不带 AppShell）——/undefined 等
  // saas 模板残渣在无壳层时静默 navigate "/"，真 404 全屏渲染。
  { path: "**", component: BadPathRedirectComponent },
];
