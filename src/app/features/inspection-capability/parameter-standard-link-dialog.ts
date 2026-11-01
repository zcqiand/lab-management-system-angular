// ParameterStandardLinkDialog — M06.F03.I02（参数↔标准关联）。
// 移植自 lab-management-system-react/src/features/inspection-capability/ParameterStandardLinkDialog.tsx
//（REQ-2026-031 L-T1，行为 1:1；react Dialog → MatDialog）。
//
// parameters 列表行内「关联标准」按钮的弹窗：列出全部检测标准（含状态），
// toggle 该参数的关联（linkStandardParameter / unlinkStandardParameter，
// DELETE 走 body）。已关联集合从 GET links/standard-parameter 全量拉回后按
// inspectionParameterCode 过滤（契约 GET 只有 standardCode 过滤，客户端补）。
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { firstValueFrom } from "rxjs";

import { InspectionDictionaryService } from "../../../api/endpoints/inspection-dictionary/inspection-dictionary.service";
import { compactParams } from "../../../api/params";
import type { InspectionStandard } from "../../../api/endpoints/model/inspectionStandard";
import { STANDARD_STATUS_CN } from "./inspection-capability-list";

@Component({
  selector: "app-parameter-standard-link-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>关联标准 — {{ data.parameterName }}</h2>
    <mat-dialog-content>
      <p class="desc">
        参数编码 {{ data.parameterCode }}；已关联 {{ linked().size }} 项（toggle
        即时保存）
      </p>
      @if (loading()) {
        <p class="loading">加载中…</p>
      } @else {
        <table>
          <thead>
            <tr>
              <th>标准编码</th>
              <th>名称</th>
              <th>版本</th>
              <th>状态</th>
              <th class="w24">操作</th>
            </tr>
          </thead>
          <tbody>
            @for (s of standards(); track s.code) {
              <tr>
                <td class="mono">{{ s.code }}</td>
                <td>{{ s.name ?? "-" }}</td>
                <td>{{ s.version ?? "-" }}</td>
                <td>{{ statusCn(s.status) }}</td>
                <td>
                  <button
                    mat-button
                    [class.outline]="linked().has(s.code)"
                    [disabled]="busyCode() === s.code"
                    (click)="toggle(s.code)"
                    data-fn="M06.F03.I02"
                    [attr.aria-label]="
                      (linked().has(s.code) ? '解除关联 ' : '关联 ') + s.code
                    "
                  >
                    {{ linked().has(s.code) ? "解除关联" : "关联" }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()">关闭</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .desc {
        font-size: 0.875rem;
        color: #64748b;
        margin: 0 0 0.75rem;
      }
      .loading {
        font-size: 0.875rem;
        color: #64748b;
        padding: 1rem 0;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
      }
      th,
      td {
        border-bottom: 1px solid #e2e8f0;
        padding: 0.4rem 0.6rem;
        text-align: left;
      }
      .mono {
        font-family: ui-monospace, monospace;
        font-size: 0.75rem;
      }
      button.outline {
        border: 1px solid #cbd5e1;
      }
    `,
  ],
})
export class ParameterStandardLinkDialogComponent {
  readonly data: {
    parameterCode: string;
    parameterName: string;
    /** 关联变化后回调（列表刷新） */
    onChanged: () => void;
  } = inject(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<ParameterStandardLinkDialogComponent>);

  private readonly api = inject(InspectionDictionaryService);

  readonly standards = signal<InspectionStandard[]>([]);
  readonly linked = signal<Set<string>>(new Set());
  readonly loading = signal(false);
  readonly busyCode = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  statusCn(status: string | undefined): string {
    return STANDARD_STATUS_CN[status ?? ""] ?? status ?? "-";
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      // 标准全量 + 关联全量（契约 GET 只有 standardCode 过滤，客户端按参数过滤）
      const [stdPage, linkPage] = await Promise.all([
        firstValueFrom(
          this.api.inspectionDictionaryListStandards(
            compactParams({ page: 1, pageSize: 500 }),
          ),
        ),
        firstValueFrom(
          this.api.inspectionDictionaryListStandardParameterLinks(compactParams({})),
        ),
      ]);
      this.standards.set(stdPage.items ?? []);
      this.linked.set(
        new Set(
          (linkPage.items ?? [])
            .filter((l) => l.inspectionParameterCode === this.data.parameterCode)
            .map((l) => l.inspectionStandardCode),
        ),
      );
    } finally {
      this.loading.set(false);
    }
  }

  async toggle(stdCode: string): Promise<void> {
    this.busyCode.set(stdCode);
    try {
      if (this.linked().has(stdCode)) {
        await firstValueFrom(
          this.api.inspectionDictionaryUnlinkStandardParameter({
            inspectionStandardCode: stdCode,
            inspectionParameterCode: this.data.parameterCode,
          }),
        );
        this.linked.update((prev) => {
          const next = new Set(prev);
          next.delete(stdCode);
          return next;
        });
      } else {
        await firstValueFrom(
          this.api.inspectionDictionaryLinkStandardParameter({
            inspectionStandardCode: stdCode,
            inspectionParameterCode: this.data.parameterCode,
          }),
        );
        this.linked.update((prev) => new Set(prev).add(stdCode));
      }
      this.data.onChanged();
    } finally {
      this.busyCode.set(null);
    }
  }
}
