import { ApplicationConfig, provideZonelessChangeDetection } from "@angular/core";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { provideRouter } from "@angular/router";
import { provideTanStackQuery, QueryClient } from "@tanstack/angular-query";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";

import { routes } from "./app.routes";
import {
  apiBaseUrlInterceptor,
  authInterceptor,
  unauthorizedInterceptor,
} from "../api/interceptors";

/**
 * zoneless 是 Angular 21+ 新项目的默认形态：无 zone.js，
 * 变更检测靠信号驱动。这里显式声明，把默认焊死。
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    // 顺序：baseUrl 前缀 → Bearer → 401 处理（同 react axios 拦截器链语义）
    provideHttpClient(
      withInterceptors([apiBaseUrlInterceptor, authInterceptor, unauthorizedInterceptor]),
    ),
    provideTanStackQuery(() => new QueryClient()),
    provideAnimationsAsync(),
  ],
};
