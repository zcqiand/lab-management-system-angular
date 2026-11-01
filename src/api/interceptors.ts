// HTTP 拦截器 — 移植自 lab-management-system-react/src/api/http-client.ts 的
// axios installHttpClient 双拦截器（REQ-2026-031）。orval angular 生成物走相对
// 路径 `/api/...` + inject(HttpClient)，三件事在 Angular 侧由 functional
// interceptor 承接（saas-angular 同款三件）：
//   1) baseUrl 前缀（每次请求动态读 getApiBaseUrl()，后端切换切完即生效）
//   2) Bearer token（从 AuthStoreService 读 localStorage 契约 key——react 的
//      getToken callback 语义；不注入服务避免循环依赖）
//   3) 401 → 清本机会话并踢回登录页（保留后端切换选择，react 同款语义）
import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { catchError, throwError } from "rxjs";
import { getApiBaseUrl } from "./backend-config";
import { TOKEN_STORAGE_KEYS } from "./contracts";

export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  // 绝对 URL（真化测试直打 baseUrl / 外部跳转）不加工
  if (/^https?:\/\//.test(req.url)) return next(req);
  return next(req.clone({ url: getApiBaseUrl() + req.url }));
};

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  let token: string | null = null;
  try {
    token = window.localStorage.getItem(TOKEN_STORAGE_KEYS.accessToken);
  } catch {
    /* localStorage 不可用：不带 Bearer */
  }
  if (!token) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

/** 401 时清本机会话并跳登录页（保留后端切换选择）。
 *  react 语义：clearPersistedSession() 扫 TOKEN_STORAGE_KEYS 全部键；这里同款，
 *  只留 lab.backend.override（切换器选择）。FSM store 的内存态由整页刷新归零。 */
function handleUnauthorized(): void {
  try {
    for (const key of Object.values(TOKEN_STORAGE_KEYS)) {
      if (key !== TOKEN_STORAGE_KEYS.activeBackend) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    /* localStorage 不可用：ignore */
  }
  window.location.assign("/login");
}

export const unauthorizedInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        const isAuthFlow = /\/api\/auth\//.test(req.url);
        const onLogin = window.location.pathname.startsWith("/login");
        if (!isAuthFlow && !onLogin) {
          handleUnauthorized();
        }
      }
      return throwError(() => err);
    }),
  );
