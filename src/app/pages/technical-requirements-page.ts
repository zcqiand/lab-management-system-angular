// TechnicalRequirementsPage — 薄 wrapper（react src/pages/TechnicalRequirementsPage.tsx 1:1 转写）。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TechnicalRequirementListComponent } from "../features/inspection-capability/technical-requirement-list";

@Component({
  selector: "app-technical-requirements-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TechnicalRequirementListComponent],
  template: `<app-technical-requirement-list />`,
})
export class TechnicalRequirementsPageComponent {}
