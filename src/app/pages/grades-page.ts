// GradesPage — 薄 wrapper（react src/pages/GradesPage.tsx 1:1 转写）。
// M04.F08 等级维护 — CategoryDictList endpoint=/grades（saas 菜单 m-grades）。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { CategoryDictListComponent } from "../features/dicts/category-dict-list";

@Component({
  selector: "app-grades-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CategoryDictListComponent],
  template: `
    <app-category-dict-list
      endpoint="/grades"
      title="等级维护"
      hint="InspectionGrade 实体码表，按检测项目过滤；拖拽调整顺序"
      dataFn="M04.F08.I01"
      createDataFn="M04.F08.I02"
      editDataFn="M04.F08.I02"
      deleteDataFn="M04.F08.I04"
    />
  `,
})
export class GradesPageComponent {}
