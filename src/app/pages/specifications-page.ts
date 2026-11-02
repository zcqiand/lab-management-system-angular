// SpecificationsPage — 薄 wrapper（react src/pages/SpecificationsPage.tsx 1:1 转写）。
// M04.F07 规格维护 — CategoryDictList endpoint=/specifications（saas 菜单 m-specs）。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { CategoryDictListComponent } from "../features/dicts/category-dict-list";

@Component({
  selector: "app-specifications-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CategoryDictListComponent],
  template: `
    <app-category-dict-list
      endpoint="/specifications"
      title="规格维护"
      hint="InspectionSpec 实体码表，按检测项目过滤；拖拽调整顺序"
      dataFn="M04.F07.I01"
      createDataFn="M04.F07.I02"
      editDataFn="M04.F07.I02"
      deleteDataFn="M04.F07.I04"
    />
  `,
})
export class SpecificationsPageComponent {}
