// CalculationMethodsPage — 薄 wrapper（react src/pages/CalculationMethodsPage.tsx 1:1 转写）。
// V016 菜单双路径：inspection-calculation-methods / inspection-calculation-rules 同渲染。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { CalculationMethodListComponent } from "../features/inspection-capability/calculation-method-list";

@Component({
  selector: "app-calculation-methods-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalculationMethodListComponent],
  template: `<app-calculation-method-list />`,
})
export class CalculationMethodsPageComponent {}
