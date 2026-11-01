// 兜底 saas post-login 把字面量字符串 "undefined" / "null" / "NaN" 拼到 URL 路径
// 直接 navigate（不走 ?from= query，sanitizeRedirect 拦不到）。
// 移植自 lab-management-system-react/src/components/app/bad-path-redirect.tsx
//（REQ-2026-031）。
//
// 触发场景：saas 的 redirect 模板拼 `${redirect}` 但 redirect 是 undefined，
// 结果浏览器拿到 `http://lab/undefined` 而不是 `http://lab/login?from=...`。
//
// 策略：
//   - 路径首段是 "undefined" / "null" / "NaN" / "false" / "true" →
//     1) 静默 navigate "/" 让守卫触发
//     2) 同时 sessionStorage 设 lab.sso.broken=1 flag，LoginPage 读到后跳过 SSO
//        （防止 SSO 循环 ping-pong：saas 反复 redirect /undefined）
//   - 其他 → 显示 404（用户手敲错 URL）
//
// 这是最后一道防线——sanitizeRedirect 是第一道（query 参数层）。
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { Router } from "@angular/router";
import { EmptyStateComponent } from "../ui/empty-state.component";
import { BAD_PATH_SEGMENTS } from "../../lib/sanitize-redirect";

export const SSO_BROKEN_FLAG = "lab.sso.broken";

export function markSsoBroken(): void {
  try {
    sessionStorage.setItem(SSO_BROKEN_FLAG, "1");
  } catch {
    /* sessionStorage 不可用时忽略 */
  }
}

export function clearSsoBroken(): void {
  try {
    sessionStorage.removeItem(SSO_BROKEN_FLAG);
  } catch {
    /* ignore */
  }
}

@Component({
  selector: "app-bad-path-redirect",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent],
  template: `
    @if (isBadPath()) {
      <div></div>
    } @else {
      <div class="notfound">
        <app-empty-state title="404" descriptionText="页面不存在" />
      </div>
    }
  `,
  styles: [
    `
      .notfound {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ],
})
export class BadPathRedirectComponent {
  private readonly router = inject(Router);

  private readonly firstSegment = computed(() => {
    const raw = this.router.url.split("?")[0];
    return raw.split("/").filter(Boolean)[0] ?? "";
  });

  readonly isBadPath = computed(() => BAD_PATH_SEGMENTS.has(this.firstSegment()));

  constructor() {
    if (this.isBadPath()) {
      // 设 SSO loop-break flag 后跳到 /，让守卫把 user 引到 /login，
      // LoginPage 看到 flag 后会跳过 SSO。
      markSsoBroken();
      void this.router.navigate(["/"], { replaceUrl: true });
    }
  }
}
