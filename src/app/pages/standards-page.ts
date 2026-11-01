// StandardsPage — 薄 wrapper（react src/pages/StandardsPage.tsx 1:1 转写）。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { InspectionCapabilityListComponent } from "../features/inspection-capability/inspection-capability-list";

@Component({
  selector: "app-standards-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InspectionCapabilityListComponent],
  template: `<app-inspection-capability-list resource="standards" />`,
})
export class StandardsPageComponent {}
