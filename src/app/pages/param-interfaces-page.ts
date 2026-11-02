// ParamInterfacesPage — 薄 wrapper（react src/pages/ParamInterfacesPage.tsx 1:1 转写）。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ParamInterfaceListComponent } from "../features/param-interfaces/param-interface-list";

@Component({
  selector: "app-param-interfaces-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ParamInterfaceListComponent],
  template: `<app-param-interface-list />`,
})
export class ParamInterfacesPageComponent {}
