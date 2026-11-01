// SidebarNav — 移植自 lab-management-system-react/src/components/app/sidebar-nav.tsx
//（REQ-2026-031）。
//
// 与 react 版的差异（镜像改造点）：
//   - 菜单数据源：lab 后端 /api/auth/menus（AppShell injectQuery 拉取并 adapt 后
//     传入；demo 兜底 2026-08-27 已删——拉取失败由 AppShell 渲染错误态，本组件
//     menus=null 时只显示加载中/空态）
//   - lucide 图标 → Material 图标名（ICON_MAP 映射，缺省渲染占位）
//   - 选中态按 Router.url 前缀匹配（react useLocation 同语义），全树 walk
//     （V016 seed 里 m-lab-dash 是顶层 leaf，只扫 depth-2 会漏它）
//   - 递归树渲染 → 计算期扁平化（rows computed，group 折叠状态参与裁剪），
//     模板只有一层 @for——ng-template 递归在 zoneless+OnPush 下更难测
// 保留：收起/展开 + localStorage 持久化（sidebar.collapsed.<appCode> /
// sidebar.groups.<appCode>）、分组树、data-fn 锚点。
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import { filter, map } from "rxjs";

import { APP_VERSION } from "../../lib/app-meta";

/** 与 saas 的 EffectiveMenuNode 对齐（手写，避免跨仓依赖；react sidebar-nav 同款） */
export interface MenuNode {
  id: string;
  appId: string;
  parentId?: string;
  code: string;
  name: string;
  path?: string;
  icon?: string;
  type: "group" | "page" | "action";
  sortOrder: number;
  children: MenuNode[];
}

/** lucide 图标名 → Material 图标名（视觉近似映射；缺省空占位） */
const ICON_MAP: Record<string, string> = {
  LayoutDashboard: "dashboard",
  FlaskConical: "science",
  TestTube2: "experiment",
  Beaker: "biotech",
  ClipboardList: "assignment",
  FileText: "description",
  ScrollText: "article",
  Shield: "shield",
  Wrench: "build",
  Settings: "settings",
  PackageSearch: "search",
  Database: "storage",
  Activity: "monitoring",
  ListChecks: "checklist",
};

/** 契约 MenuNode（shared tsp：id/label/path?/icon?/children?）→ 本地渲染 MenuNode。
 *  AppShell 拉到后端菜单后逐棵 adapt（react adaptContractMenu 同款）。 */
export function adaptContractMenu(
  node: {
    id: string;
    label: string;
    path?: string;
    icon?: string;
    children?: Array<{
      id: string;
      label: string;
      path?: string;
      icon?: string;
      children?: unknown[];
    }>;
  },
  index: number,
  appCode: string,
): MenuNode {
  const children = (node.children ?? []) as Parameters<typeof adaptContractMenu>[0][];
  return {
    id: node.id,
    appId: appCode,
    code: node.id,
    name: node.label,
    path: node.path,
    icon: node.icon,
    // 契约无 type 字段：有子节点即 group，否则 page
    type: children.length > 0 ? "group" : "page",
    sortOrder: index + 1,
    children: children.map((c, i) => adaptContractMenu(c, i, appCode)),
  };
}

/** 扁平化行：group header（可折叠）或 leaf 按钮 */
interface NavRow {
  kind: "group" | "leaf";
  node: MenuNode;
  depth: number;
  childCount: number;
  collapsed: boolean;
}

@Component({
  selector: "app-sidebar-nav",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatTooltipModule],
  templateUrl: "./sidebar-nav.html",
  styles: [
    `
      :host {
        display: block;
      }
      aside {
        height: 100vh;
        display: flex;
        flex-direction: column;
        background: #0f172a;
        color: #fff;
        transition: width 0.2s;
        overflow: hidden;
      }
      aside[data-collapsed="true"] {
        width: 3.5rem;
      }
      aside[data-collapsed="false"] {
        width: 15rem;
      }
      .brand {
        display: flex;
        align-items: center;
        border-bottom: 1px solid rgb(255 255 255 / 0.1);
      }
      .brand.expanded {
        padding: 1rem 1.25rem;
        gap: 0.5rem;
      }
      .brand.collapsed {
        justify-content: center;
        padding: 1rem 0;
      }
      .brand-inner {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex: 1;
        min-width: 0;
      }
      .brand-inner.center {
        justify-content: center;
      }
      .logo {
        height: 2rem;
        width: 2rem;
        border-radius: 6px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.875rem;
        font-weight: 700;
        background: linear-gradient(135deg, #3b82f6, #9333ea);
      }
      .brand-text {
        flex: 1;
        min-width: 0;
      }
      .brand-text h1 {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 700;
        line-height: 1.25;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .brand-text p {
        margin: 0;
        font-size: 0.75rem;
        color: rgb(255 255 255 / 0.5);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .toggle {
        flex-shrink: 0;
        margin-left: auto;
        height: 1.75rem;
        width: 1.75rem;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: rgb(255 255 255 / 0.6);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .toggle:hover {
        color: #fff;
        background: rgb(255 255 255 / 0.1);
      }
      .brand.collapsed .toggle {
        margin-left: 0;
      }
      nav {
        flex: 1;
        overflow-y: auto;
        padding: 0.75rem 0.5rem;
      }
      .hint {
        font-size: 0.75rem;
        color: rgb(255 255 255 / 0.4);
        margin: 0;
        padding: 0 0.75rem;
      }
      .hint.center {
        text-align: center;
        padding: 0;
      }
      .group-header {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.625rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: rgb(255 255 255 / 0.4);
        padding: 0.75rem 0.75rem 0.25rem;
        border-top: 1px solid rgb(255 255 255 / 0.05);
      }
      .group-header.first {
        border-top: none;
      }
      .group-header .gname {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .group-header button {
        all: unset;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.375rem;
        flex: 1;
        min-width: 0;
      }
      .group-header button:hover {
        color: rgb(255 255 255 / 0.8);
      }
      .group-header .count {
        margin-left: auto;
        font-size: 0.5625rem;
        color: rgb(255 255 255 / 0.3);
        display: inline-flex;
        align-items: center;
        gap: 0.125rem;
      }
      .group-header .count .chev {
        font-size: 0.625rem;
        width: 0.625rem;
        height: 0.625rem;
      }
      .leaf-wrap {
        position: relative;
      }
      .leaf {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        text-align: left;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: rgb(255 255 255 / 0.7);
        font-size: 0.875rem;
        padding: 0.375rem 0.75rem;
        cursor: pointer;
      }
      .leaf:hover {
        background: rgb(255 255 255 / 0.1);
        color: #fff;
      }
      .leaf.selected {
        background: #334155;
        color: #fff;
      }
      .leaf:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .leaf .label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .footer {
        border-top: 1px solid rgb(255 255 255 / 0.1);
        padding: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      mat-icon {
        font-size: 1rem;
        width: 1rem;
        height: 1rem;
      }
    `,
  ],
})
export class SidebarNavComponent {
  /** 菜单树。null 表示还在加载（AppShell 拉取失败时渲染错误态，不会传 null 进来） */
  readonly menus = input<MenuNode[] | null>(null);
  readonly appCode = input.required<string>();
  readonly appName = input<string | null>(null);

  private readonly router = inject(Router);

  readonly appVersion = APP_VERSION;

  // 选中态依赖 Router.url——toSignal(NavigationEnd) 让 computed 随导航重算
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  // 全局收起/展开：状态持久化到 localStorage（按 appCode 区分），刷新保留
  readonly collapsed = signal(false);

  // 分组收起/展开：每个 group code 一项；仅在展开态生效
  private readonly groupCollapsed = signal<Set<string>>(new Set());

  // localStorage 恢复放 effect（NG8118：required input 在构造期没有值；
  // effect 首跑在 inputs 就位后）。只读 appCode 一个依赖，写 collapsed/groupCollapsed
  // 不成环。
  constructor() {
    effect(() => {
      const appCode = this.appCode();
      try {
        if (window.localStorage.getItem(`sidebar.collapsed.${appCode}`) === "1") {
          this.collapsed.set(true);
        }
        const raw = window.localStorage.getItem(`sidebar.groups.${appCode}`);
        if (raw) {
          const arr = JSON.parse(raw) as unknown;
          if (Array.isArray(arr)) {
            this.groupCollapsed.set(
              new Set(arr.filter((x): x is string => typeof x === "string")),
            );
          }
        }
      } catch {
        /* 无 storage 时忽略 */
      }
    });
  }

  toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    try {
      window.localStorage.setItem(
        `sidebar.collapsed.${this.appCode()}`,
        next ? "1" : "0",
      );
    } catch {
      /* ignore */
    }
  }

  toggleGroup(code: string): void {
    this.groupCollapsed.update((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      try {
        window.localStorage.setItem(
          `sidebar.groups.${this.appCode()}`,
          JSON.stringify([...next]),
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  /** 选中 code：递归全树按 url 前缀匹配（menus=null 跳过，react 同款） */
  readonly selectedCode = computed<string | null>(() => {
    const menus = this.menus();
    if (!menus) return null;
    const pathname = this.url().split("?")[0];
    const findMatch = (nodes: MenuNode[]): string | null => {
      for (const n of nodes) {
        if (n.path !== undefined) {
          if (n.path === "" && pathname === "/") return n.code;
          if (
            n.path !== "" &&
            (pathname === `/${n.path}` || pathname.startsWith(`/${n.path}/`))
          ) {
            return n.code;
          }
        }
        if (n.children.length > 0) {
          const hit = findMatch(n.children);
          if (hit) return hit;
        }
      }
      return null;
    };
    return findMatch(menus);
  });

  /** 扁平化渲染行：group header 折叠时裁掉子树；icon-only 模式全铺开 */
  readonly rows = computed<NavRow[]>(() => {
    const menus = this.menus();
    if (!menus) return [];
    const collapsed = this.collapsed();
    const groupCollapsed = collapsed ? new Set<string>() : this.groupCollapsed();
    const out: NavRow[] = [];
    const walk = (nodes: MenuNode[], depth: number): void => {
      for (const n of nodes) {
        const isGroup = n.children.length > 0;
        if (isGroup) {
          const isCollapsed = groupCollapsed.has(n.code);
          out.push({
            kind: "group",
            node: n,
            depth,
            childCount: n.children.length,
            collapsed: isCollapsed,
          });
          if (!isCollapsed) walk(n.children, depth + 1);
        } else {
          out.push({ kind: "leaf", node: n, depth, childCount: 0, collapsed: false });
        }
      }
    };
    walk(menus, 0);
    return out;
  });

  iconOf(name: string | undefined): string {
    return (name && ICON_MAP[name]) || "";
  }

  onSelect(node: MenuNode): void {
    // 叶子节点（有 path）→ 跳 /<path>；group 节点无 onSelect
    if (node.path !== undefined) void this.router.navigate([`/${node.path}`]);
  }
}
