import { TestBed } from "@angular/core/testing";
import { describe, expect, it } from "vitest";

import { AppComponent } from "./app.component";

// 工程设施冒烟：验证 TestBed + vitest 通道可用。不挂业务 ID（工程设施的测试不挂）。
describe("AppComponent", () => {
  it("创建组件", async () => {
    await TestBed.configureTestingModule({ imports: [AppComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
