// 真链路探针（REQ-2026-031 T-L0，工程设施测试——不挂业务 ID）。
// 验证 angular 测试栈的全链路桥：globalSetup 种子 + 真 :5201 + 真 JWT（LAB_JWT
// 铸造，tenant_id claim 直读，无需 membership 快照）→ localStorage 契约 key →
// authInterceptor 取 Bearer → orval ContractsService → 真后端 /api/contracts 200
// 且种子行可见。任何一环断，先于所有页面测试红——这是页面测试的地基。
//
// 刻意不打 /api/auth/me：membership/user 快照由真 login/sso callback 写入（进程内
// 缓存），铸造 token 的 sub 无快照必 401（ADR-0019 负语义的正确表现）——
// 前端 hydrate 真链路语义由 auth-store.spec.ts 的打桩面覆盖。
import { TestBed } from "@angular/core/testing";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { provideTanStackQuery, QueryClient } from "@tanstack/angular-query";
import { firstValueFrom } from "rxjs";
import { beforeEach, describe, expect, it } from "vitest";

import { installRealChain, SEED } from "../../tests/helpers/real-chain";
import {
  apiBaseUrlInterceptor,
  authInterceptor,
  unauthorizedInterceptor,
} from "../api/interceptors";
import { ContractsService } from "../api/endpoints/contracts/contracts.service";

describe("真链路探针（工程设施，无 fn ID）", () => {
  beforeEach(() => {
    installRealChain();
  });

  it("contractsListContracts 经 拦截器+orval+真后端 返回种子合同", async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([
            apiBaseUrlInterceptor,
            authInterceptor,
            unauthorizedInterceptor,
          ]),
        ),
        provideTanStackQuery(() => new QueryClient()),
      ],
    });
    const page = await firstValueFrom(
      TestBed.inject(ContractsService).contractsListContracts(),
    );
    // 种子行经服务可见 = 测试连的就是 globalSetup 灌的目标库（库身份语义与
    // global-setup 步骤 5 同源，此处再证一次 orval 面 + 拦截器链无断点）
    const marker = SEED.contracts[0]!.contract_code;
    expect(page.items.some((c) => c.contractCode === marker)).toBe(true);
    expect(page.total).toBeGreaterThanOrEqual(SEED.contracts.length);
  });
});
