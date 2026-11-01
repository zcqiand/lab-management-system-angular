import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { describe, expect, it } from "vitest";

import { AppComponent } from "./app.component";

// 工程设施冒烟：验证 TestBed + vitest 通道可用。不挂业务 ID（工程设施的测试不挂）。
// AppComponent 构造期 hydrate（AuthStoreService → AuthService → HttpClient），
// 无 localStorage token 时落 anonymous、不打网络——仅需 provideHttpClient。
describe("AppComponent", () => {
  it("创建组件", async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient()],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
