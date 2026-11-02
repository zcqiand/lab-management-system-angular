// ModelsPage — 薄 wrapper（react src/pages/ModelsPage.tsx 1:1 转写）。
// M04.F06 型号维护 — CategoryDictList endpoint=/models（saas 菜单 m-models）。
// 注意：editDataFn 走 I02（angular 树「新建/编辑型号」合一；react 树的 I03
// 已废弃不入 angular 镜像），删除走 I04（引用保护，编号收敛对齐 BASE）。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { CategoryDictListComponent } from "../features/dicts/category-dict-list";

@Component({
  selector: "app-models-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CategoryDictListComponent],
  template: `
    <app-category-dict-list
      endpoint="/models"
      title="型号维护"
      hint="InspectionModel 实体码表，按检测项目过滤；拖拽调整顺序"
      dataFn="M04.F06.I01"
      createDataFn="M04.F06.I02"
      editDataFn="M04.F06.I02"
      deleteDataFn="M04.F06.I04"
    />
  `,
})
export class ModelsPageComponent {}
