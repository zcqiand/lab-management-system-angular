import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import angular from "angular-eslint";

/**
 * 机器可判定的规则落在这里，不留在 markdown。
 * 提示词里的禁令靠自觉，eslint 里的禁令靠 exit code。
 *
 * 模板类判断规则（变更策略、可访问性）angular-eslint 管；
 * 架构类规则（api 层、token 纪律）eslint 看不见，在项目 CLAUDE.md 禁令区。
 *
 * 形状注（2026-10-31 首航实测）：angular-eslint v22 的 configs.tsRecommended /
 * templateRecommended 是数组且条目不带 files——必须逐条挂 files 再摊平：
 * 整数组塞进单对象会变数字键（eslint 报 Unexpected key "0"）；裸摊平则
 * template parser 会去解析所有 .ts（ICU message 假红）。processor 也需单独挂。
 */
export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage", ".angular", "out-tsc"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...angular.configs.tsRecommended.map((c) => ({ files: ["**/*.ts"], ...c })),
  {
    files: ["**/*.ts"],
    processor: angular.processInlineTemplates,
    rules: {
      // 项目 CLAUDE.md 的硬约束
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",

      // 命名与选择器一致性
      "@angular-eslint/directive-selector": [
        "error",
        { type: "attribute", prefix: "app", style: "camelCase" },
      ],
      "@angular-eslint/component-selector": [
        "error",
        { type: "element", prefix: "app", style: "kebab-case" },
      ],
    },
  },
  ...angular.configs.templateRecommended.map((c) => ({
    files: ["**/*.html"],
    ...c,
  })),
);
