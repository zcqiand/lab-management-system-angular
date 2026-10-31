import { ApplicationConfig, provideZonelessChangeDetection } from "@angular/core";

/**
 * zoneless 是 Angular 21+ 新项目的默认形态：无 zone.js，
 * 变更检测靠信号驱动。这里显式声明，把默认焊死。
 */
export const appConfig: ApplicationConfig = {
  providers: [provideZonelessChangeDetection()],
};
