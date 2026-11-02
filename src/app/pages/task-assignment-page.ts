// TaskAssignmentPage — 薄 wrapper（react src/pages/TaskAssignmentPage.tsx 1:1 转写）。
// M03.F02 任务分配 — 流程线第二环节。
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TaskAssignmentListComponent } from "../features/task-assignment/task-assignment-list";

@Component({
  selector: "app-task-assignment-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TaskAssignmentListComponent],
  template: `<app-task-assignment-list />`,
})
export class TaskAssignmentPageComponent {}
