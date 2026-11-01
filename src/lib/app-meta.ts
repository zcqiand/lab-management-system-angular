// 应用元信息（版本号单一来源 = package.json，resolveJsonModule 直读）。
// 消费方：SidebarNav 品牌头版本行。镜像 lab-management-system-react src/lib/app-meta.ts
//（2026-09-23 用户裁定：品牌头 appCode 行换版本号，appCode 仍参与持久化 key）。
import pkg from "../../package.json";

export const APP_VERSION: string = pkg.version;
