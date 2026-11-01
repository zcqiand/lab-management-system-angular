// query 参数清洗 — axios 语义补丁（REQ-2026-031 L-T1 实测指纹）。
//
// react 仓 axios 对 `params: { keyword: undefined }` 直接丢键；Angular HttpClient
// 的 HttpParams 会把 undefined 序列化成字面量 `keyword=undefined` 发上线——
// 后端 keyword 过滤按 "undefined" 匹配 → 列表恒空（2026-11-01 capability 列表
// 首航踩坑：服务直调有数据、组件装载恒 0 条）。
//
// orval 生成物不动（API 面只认生成物），查询参数一律经本 helper 收口：
// GET 调用点用 `compactParams({...})` 包一层，undefined 键剥除后再交给生成服务，
// 与 react/axios 的线上语义 1:1。请求体不需要（JSON.stringify 本就丢 undefined）。
export function compactParams<T extends object>(params: T): T {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined),
  ) as T;
}
