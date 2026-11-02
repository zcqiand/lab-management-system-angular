// M06.F07.I02 fnTest — 报告名称↔标准/参数关联（ReportNameLinkDialog toggle）。
// 移植自 lab-management-system-react/tests/features/report-names/reportNameLink.dom.test.tsx
//（REQ-2026-031 L-T1③，真链路语义 1:1）。
//
// 报告名称列表行内「关联」→ 弹窗两段列表（标准 role=TESTING / 参数）→
// toggle POST/DELETE /api/report-names/links/{standard,parameter}。
//
// 隔离纪律：toggle POST 会写真库（lab_test links 表）——beforeEach 兜底清场、
// afterEach 按精确 pair DELETE 回收，保证种子锚关联态可复现。清理走
// **query 参数**（react task-9 指纹：真后端 linkDelete 只读 query）。
import { HttpClient } from "@angular/common/http";
import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { fireEvent, screen, waitFor } from "@testing-library/dom";
import { firstValueFrom } from "rxjs";
import { beforeEach, afterEach, describe, expect } from "vitest";

import { fnTest } from "../../../../tests/fn";
import {
  firstUnlinkedParameterFor,
  installRealChain,
} from "../../../../tests/helpers/real-chain";
import { realChainHttpProviders } from "../../../../tests/helpers/ng-test";
import { compactParams } from "../../../api/params";
import { ReportNameLinkDialogComponent } from "./report-name-link-dialog";

/** 种子锚报告名称：RN-101（水泥），标准/参数两侧在种子中均有关联。 */
const REPORT_NAME = "RN-101";
/** toggle 目标：种子层面未关联的首个参数编码（纯种子计算，确定性）。 */
const TOGGLE_TARGET = firstUnlinkedParameterFor(REPORT_NAME);

/** MatDialog overlay 需要一个宿主 fixture 驱动 CD（Material 单测同款手法）。 */
@Component({ standalone: true, template: `<div></div>` })
class DialogHostStubComponent {}

function openLinkDialog() {
  // providers 已在 beforeEach configure（清场 inject 会实例化模块，测试内
  // 再 configure 会撞 "already instantiated"）——这里只建宿主 fixture。
  const fixture = TestBed.createComponent(DialogHostStubComponent);
  const ref = TestBed.inject(MatDialog).open(ReportNameLinkDialogComponent, {
    width: "44rem",
    data: {
      reportNameCode: REPORT_NAME,
      reportNameLabel: "检测报告",
      onChanged: () => {},
    },
  });
  fixture.detectChanges();
  return { fixture, ref };
}

function unlinkParamPair(): Promise<unknown> {
  // 契约路径 /api/report-names/links/parameter（与 orval 生成物一致）；
  // realChainHttpProviders 拦截器链补 baseURL/token。
  return firstValueFrom(
    TestBed.inject(HttpClient).delete("/api/report-names/links/parameter", {
      params: compactParams({
        reportNameCode: REPORT_NAME,
        inspectionParameterCode: TOGGLE_TARGET,
      }),
    }),
  );
}

beforeEach(async () => {
  installRealChain();
  // 清场：toggle 目标 pair 若因上次异常中断残留，先解除
  TestBed.configureTestingModule({ providers: [realChainHttpProviders()] });
  await unlinkParamPair().catch(() => {});
});

afterEach(async () => {
  // 回收 toggle 产生的关联行（真库不随测试复位）
  await unlinkParamPair().catch(() => {});
});

describe("M06.F07.I02 报告名称↔标准/参数关联", () => {
  fnTest(
    ["M06.F07.I02"],
    // 两段列表 = standards + parameters + 两路 links 并发（真链路延迟预算见
    // tests/helpers/real-chain.ts 文件头）
    "关联弹窗：两段列表渲染（标准 + 参数，真后端种子数据穿透）",
    async () => {
      openLinkDialog();
      await waitFor(() => {
        // aria-label 形如「关联标准 GB 175-2023」/「解除参数 IP-0001」
        expect(
          screen.getAllByRole("button", { name: /^(关联|解除)(标准|参数) / }).length,
        ).toBeGreaterThan(1);
      });
      // 种子锚：RN-101 两侧关联非空（shared 种子 209 标准 / 261 参数关联行覆盖）
      expect(screen.getByText("关联维护 — 检测报告")).toBeTruthy();
      expect(screen.getByText("检测标准（role=检测）")).toBeTruthy();
      expect(screen.getByText("检测参数")).toBeTruthy();
      await waitFor(() => {
        expect(
          screen.getAllByRole("button", { name: /^解除标准 / }).length,
        ).toBeGreaterThan(0);
        expect(
          screen.getAllByRole("button", { name: /^解除参数 / }).length,
        ).toBeGreaterThan(0);
      });
    },
  );

  fnTest(
    ["M06.F07.I02"],
    `toggle 参数：未关联参数 ${TOGGLE_TARGET} → POST 后按钮翻「解除」`,
    async () => {
      openLinkDialog();
      const btn = await waitFor(() => {
        const b = screen.getByRole("button", { name: `关联参数 ${TOGGLE_TARGET}` });
        expect(b).toBeTruthy();
        return b;
      });
      fireEvent.click(btn);
      // POST 成功后按钮翻转为解除参数（即时保存语义）
      await waitFor(() => {
        expect(
          screen.getAllByRole("button", { name: `解除参数 ${TOGGLE_TARGET}` }),
        ).toHaveLength(1);
      });
    },
  );
});
