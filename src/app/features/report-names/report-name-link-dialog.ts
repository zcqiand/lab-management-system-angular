// M06.F07.I02 报告名称↔标准/参数关联弹窗 — 移植自
// lab-management-system-react/src/features/report-names/ReportNameLinkDialog.tsx
//（REQ-2026-031 L-T1③，行为 1:1；react Dialog → MatDialog，toast → 弹窗内提示条）。
//
// 两段列表（标准 role=TESTING / 参数），toggle 关联（orval report-names tag：
// link/unlink ReportNameStandard / ReportNameParameter，DELETE 走 body——与
// react 组件同形态；测试清场走 query 参数，见 report-name-link.spec.ts 注记）。
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { firstValueFrom } from "rxjs";

import { ReportNamesService } from "../../../api/endpoints/report-names/report-names.service";
import { InspectionDictionaryService } from "../../../api/endpoints/inspection-dictionary/inspection-dictionary.service";
import { compactParams } from "../../../api/params";
import type { InspectionStandard } from "../../../api/endpoints/model/inspectionStandard";
import type { InspectionParameter } from "../../../api/endpoints/model/inspectionParameter";
import type { ReportNameStandardLink } from "../../../api/endpoints/model/reportNameStandardLink";

/** react 版 toast 语义：弹窗内一次性提示条。 */
@Component({
  selector: "app-report-name-link-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>关联维护 — {{ data.reportNameLabel }}</h2>
    <mat-dialog-content>
      <p class="desc">
        报告名称 {{ data.reportNameCode }}；标准 {{ stdLinks().length }} 项 / 参数
        {{ paramLinks().size }} 项 （toggle 即时保存）
      </p>
      @if (notice(); as n) {
        <div role="status" class="notice">{{ n }}</div>
      }
      @if (loading()) {
        <p class="muted">加载中…</p>
      } @else {
        <section>
          <h4>检测标准（role=检测）</h4>
          <div class="rows">
            @for (s of standards(); track s.code) {
              <div class="row">
                <span>
                  <span class="mono">{{ s.code }}</span> {{ s.name }}
                  @if (s.status === "active") {
                    <span class="badge">现行</span>
                  }
                </span>
                <button
                  mat-button
                  [disabled]="busy() === s.code"
                  (click)="toggleStd(s.code)"
                  data-fn="M06.F07.I02"
                  [attr.aria-label]="
                    (isStdOn(s.code) ? '解除标准' : '关联标准') + ' ' + s.code
                  "
                >
                  {{ isStdOn(s.code) ? "解除" : "关联" }}
                </button>
              </div>
            }
          </div>
        </section>
        <section>
          <h4>检测参数</h4>
          <div class="rows">
            @for (p of parameters(); track p.code) {
              <div class="row">
                <span>
                  <span class="mono">{{ p.code }}</span> {{ p.name }}
                  @if (p.unit) {
                    <span class="muted-xs">({{ p.unit }})</span>
                  }
                </span>
                <button
                  mat-button
                  [disabled]="busy() === p.code"
                  (click)="toggleParam(p.code)"
                  data-fn="M06.F07.I02"
                  [attr.aria-label]="
                    (isParamOn(p.code) ? '解除参数' : '关联参数') + ' ' + p.code
                  "
                >
                  {{ isParamOn(p.code) ? "解除" : "关联" }}
                </button>
              </div>
            }
          </div>
        </section>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">关闭</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .desc {
        font-size: 0.75rem;
        color: #64748b;
        margin: 0 0 0.5rem;
      }
      .notice {
        font-size: 0.75rem;
        color: #16a34a;
        background: #f0fdf4;
        padding: 0.375rem 0.5rem;
        border-radius: 0.25rem;
        margin-bottom: 0.5rem;
      }
      .muted {
        color: #94a3b8;
        font-size: 0.875rem;
      }
      .muted-xs {
        font-size: 0.75rem;
        color: #94a3b8;
        margin-left: 0.25rem;
      }
      h4 {
        font-size: 0.875rem;
        font-weight: 600;
        margin: 0.75rem 0 0.375rem;
      }
      .rows {
        display: grid;
        gap: 0.25rem;
      }
      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.875rem;
      }
      .row:hover {
        background: #f8fafc;
      }
      .mono {
        font-family: ui-monospace, monospace;
        font-size: 0.75rem;
      }
      .badge {
        display: inline-block;
        margin-left: 0.5rem;
        font-size: 0.625rem;
        padding: 0.0625rem 0.375rem;
        border-radius: 9999px;
        background: #dbeafe;
        color: #1d4ed8;
      }
    `,
  ],
})
export class ReportNameLinkDialogComponent {
  readonly data: {
    reportNameCode: string;
    reportNameLabel: string;
    onChanged: () => void;
  } = inject(MAT_DIALOG_DATA);
  readonly ref =
    inject<MatDialogRef<ReportNameLinkDialogComponent, boolean>>(MatDialogRef);

  private readonly api = inject(ReportNamesService);
  private readonly dict = inject(InspectionDictionaryService);

  readonly standards = signal<InspectionStandard[]>([]);
  readonly parameters = signal<InspectionParameter[]>([]);
  readonly stdLinks = signal<ReportNameStandardLink[]>([]);
  readonly paramLinks = signal<Set<string>>(new Set());
  readonly loading = signal(true);
  readonly busy = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  isStdOn(stdCode: string): boolean {
    return this.stdLinks().some(
      (l) => l.inspectionStandardCode === stdCode && l.role === "TESTING",
    );
  }

  isParamOn(paramCode: string): boolean {
    return this.paramLinks().has(paramCode);
  }

  private setNotice(msg: string): void {
    this.notice.set(msg);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [stdResp, paramResp, stdLinkResp, paramLinkResp] = await Promise.all([
        firstValueFrom(
          this.dict.inspectionDictionaryListStandards(
            compactParams({ page: 1, pageSize: 500 }),
          ),
        ),
        firstValueFrom(
          this.dict.inspectionDictionaryListParameters(
            compactParams({ page: 1, pageSize: 500 }),
          ),
        ),
        firstValueFrom(
          this.api.reportNamesListReportNameStandardLinks(
            compactParams({ reportNameCode: this.data.reportNameCode }),
          ),
        ),
        firstValueFrom(
          this.api.reportNamesListReportNameParameterLinks(
            compactParams({ reportNameCode: this.data.reportNameCode }),
          ),
        ),
      ]);
      this.standards.set(stdResp.items ?? []);
      this.parameters.set(paramResp.items ?? []);
      this.stdLinks.set(stdLinkResp.items ?? []);
      this.paramLinks.set(
        new Set((paramLinkResp.items ?? []).map((l) => l.inspectionParameterCode)),
      );
    } catch (err) {
      this.setNotice(`加载关联失败：${(err as Error).message}`);
    } finally {
      this.loading.set(false);
    }
  }

  /** role 简化为 TESTING（检测依据）；判定标准关联由后续 batch 细化。 */
  async toggleStd(stdCode: string): Promise<void> {
    const existing = this.stdLinks().find(
      (l) => l.inspectionStandardCode === stdCode && l.role === "TESTING",
    );
    this.busy.set(stdCode);
    this.notice.set(null);
    try {
      if (existing) {
        await firstValueFrom(
          this.api.reportNamesUnlinkReportNameStandard({
            reportNameCode: this.data.reportNameCode,
            inspectionStandardCode: stdCode,
            role: "TESTING",
          }),
        );
        this.stdLinks.set(
          this.stdLinks().filter(
            (l) => !(l.inspectionStandardCode === stdCode && l.role === "TESTING"),
          ),
        );
        this.setNotice(`已解除标准 ${stdCode}`);
      } else {
        await firstValueFrom(
          this.api.reportNamesLinkReportNameStandard({
            reportNameCode: this.data.reportNameCode,
            inspectionStandardCode: stdCode,
            role: "TESTING",
          }),
        );
        this.stdLinks.set([
          ...this.stdLinks(),
          {
            reportNameCode: this.data.reportNameCode,
            inspectionStandardCode: stdCode,
            role: "TESTING",
          },
        ]);
        this.setNotice(`已关联标准 ${stdCode}`);
      }
      this.data.onChanged();
    } catch (err) {
      this.setNotice(`标准关联失败：${(err as Error).message}`);
    } finally {
      this.busy.set(null);
    }
  }

  async toggleParam(paramCode: string): Promise<void> {
    this.busy.set(paramCode);
    this.notice.set(null);
    try {
      if (this.paramLinks().has(paramCode)) {
        await firstValueFrom(
          this.api.reportNamesUnlinkReportNameParameter({
            reportNameCode: this.data.reportNameCode,
            inspectionParameterCode: paramCode,
          }),
        );
        const next = new Set(this.paramLinks());
        next.delete(paramCode);
        this.paramLinks.set(next);
        this.setNotice(`已解除参数 ${paramCode}`);
      } else {
        await firstValueFrom(
          this.api.reportNamesLinkReportNameParameter({
            reportNameCode: this.data.reportNameCode,
            inspectionParameterCode: paramCode,
          }),
        );
        this.paramLinks.set(new Set(this.paramLinks()).add(paramCode));
        this.setNotice(`已关联参数 ${paramCode}`);
      }
      this.data.onChanged();
    } catch (err) {
      this.setNotice(`参数关联失败：${(err as Error).message}`);
    } finally {
      this.busy.set(null);
    }
  }
}
