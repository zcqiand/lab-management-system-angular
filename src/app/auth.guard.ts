// 路由守卫 — 对应 react 仓 useRequireAuth（M01.F04.I03，REQ-2026-031）：
//   - idle（hydrate 中）→ ensureHydrated 等到落态再判（react checking 态语义）
//   - anonymous → /login?from=<当前路径>（登录成功回跳）
//   - awaiting_tenant → /login（选租户页已移除，多租户由 saas 侧预选）
//   - authenticated → 放行
import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthStoreService } from "../state/auth-store.service";

export const authGuard: CanActivateFn = async (_route, state) => {
  const store = inject(AuthStoreService);
  const router = inject(Router);
  const s = await store.ensureHydrated();
  if (s.kind === "authenticated") return true;
  const from = state.url;
  if (s.kind === "anonymous" && from && from !== "/") {
    return router.createUrlTree(["/login"], {
      queryParams: { from },
    });
  }
  return router.createUrlTree(["/login"]);
};
