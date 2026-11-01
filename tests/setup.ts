// vitest setup（angular 版，REQ-2026-031，移植自 saas-angular tests/setup.ts）。
//
// react 版在模块级装 axios 拦截器（axios 是全局单例）；angular 的拦截器由
// TestBed providers 注入（每测试独立 injector），没有全局可装的东西——
// 所以本文件只剩 jest-dom matchers + afterEach localStorage 复位：
//   （localStorage 里的会话由各测试 beforeEach 调 installRealChain() 写回；
//    AuthStoreService 是 providedIn:root，TestBed 每测试重建 injector 时
//    重新从 localStorage hydrate——时序与 react AuthProvider mount 一致。）
// angular 的 DOM 卸载由 TestBed 自动 resetTestingModule 承担，无需 RTL cleanup。
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

afterEach(() => {
  localStorage.clear();
});
