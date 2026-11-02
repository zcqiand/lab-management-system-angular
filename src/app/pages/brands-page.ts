// BrandsPage — 薄 wrapper（react src/pages/BrandsPage.tsx 1:1 转写）。
// M04.F09 牌号维护 — CategoryDictList endpoint=/brands（saas 菜单 m-brands）。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { CategoryDictListComponent } from "../features/dicts/category-dict-list";

@Component({
  selector: "app-brands-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CategoryDictListComponent],
  template: `
    <app-category-dict-list
      endpoint="/brands"
      title="牌号维护"
      hint="InspectionBrand 实体码表，按检测项目过滤；拖拽调整顺序"
      dataFn="M04.F09.I01"
      createDataFn="M04.F09.I02"
      editDataFn="M04.F09.I02"
      deleteDataFn="M04.F09.I04"
    />
  `,
})
export class BrandsPageComponent {}
