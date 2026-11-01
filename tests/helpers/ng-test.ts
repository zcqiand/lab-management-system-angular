// tests/helpers/ng-test.ts — angular TestBed 真链路公共 provider 组装 + 交互助手
// （REQ-2026-031 T-L0；移植自 saas-identity-platform-angular/tests/helpers/ng-test.ts，
// 语义对齐 lab-react tests 里重复的 Provider 包裹层）。
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { provideZonelessChangeDetection } from "@angular/core";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { provideRouter, RouterOutlet, type Routes } from "@angular/router";
import { provideTanStackQuery, QueryClient } from "@tanstack/angular-query";
import type { ComponentFixture } from "@angular/core/testing";

import {
  apiBaseUrlInterceptor,
  authInterceptor,
  unauthorizedInterceptor,
} from "../../src/api/interceptors";
import { LoginPageComponent } from "../../src/app/pages/login-page";

/** "/" 落点桩（登录成功 sanitizeRedirect 缺省跳 "/" 的断言落点）。 */
@Component({
  selector: "app-home-stub",
  standalone: true,
  template: `<div data-testid="home-stub"></div>`,
})
export class HomeStubComponent {}

/** 路由宿主：react 测试的 MemoryRouter 等价物——navigate 的落点必须有 outlet 才
 *  会渲染（裸挂页面组件时 router.navigate 静默不渲染，saas 批 2026-10-31 实测
 *  指纹：登录成功断言 60s 超时就是它）。 */
@Component({
  selector: "app-test-host",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class TestHostComponent {}

/**
 * 真链路（真 HTTP + 拦截器链）providers 组装。登录/列表正路径直连真 :5201。
 * 需要打桩 HTTP 时改用 provideHttpClientTesting() 覆盖（见各 spec）。
 * routes 缺省 = 登录页 + "/" 落点桩（sanitizeRedirect 缺省跳 "/"）；
 * 页面 spec 传自己的路由表覆盖。
 */
export function realChainProviders(routes?: Routes): unknown[] {
  return [
    provideZonelessChangeDetection(),
    provideNoopAnimations(),
    provideHttpClient(
      withInterceptors([apiBaseUrlInterceptor, authInterceptor, unauthorizedInterceptor]),
    ),
    provideTanStackQuery(() => new QueryClient()),
    provideRouter(
      routes ?? [
        { path: "login", component: LoginPageComponent },
        { path: "", component: HomeStubComponent, pathMatch: "full" },
      ],
    ),
  ];
}

/** 往表单控件灌值并触发 ngModel（angular 无 fireEvent.change 的 React 合成层）。 */
export function typeInto(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** zoneless 下事件后的稳定等待：先 CD 再等微任务排空。 */
export async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

/** jsdom location.href 只读——Proxy 拦截赋值记录目标（lab-react 同款手法）。
 *  get 陷阱必须把 getter 的 receiver 绑回真 Location（Reflect.get 第三参）：
 *  jsdom 的 IDL 包装层拒绝非 Location 实例上的属性访问，裸 Proxy 会让组件里
 *  的 window.location.search 直接 TypeError（saas 批 2026-10-31 实测指纹）。 */
export function interceptLocationHref(): {
  assigned: () => string;
  count: () => number;
  restore: () => void;
} {
  const original = window.location;
  let assignedHref = "";
  let hits = 0;
  Object.defineProperty(window, "location", {
    configurable: true,
    get() {
      return new Proxy(original, {
        set(target, prop, value) {
          if (prop === "href") {
            assignedHref = String(value);
            hits += 1;
            return true;
          }
          return Reflect.set(target, prop, value);
        },
        get(target, prop) {
          const v = Reflect.get(target, prop, target);
          return typeof v === "function" ? v.bind(target) : v;
        },
      });
    },
  });
  return {
    assigned: () => assignedHref,
    count: () => hits,
    restore: () =>
      Object.defineProperty(window, "location", {
        configurable: true,
        value: original,
      }),
  };
}
