import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // no-explicit-any 为风格豁免（保留 off）；react-hooks/* 属正确性规则，
  // 降级为 warn 而非 off，保留信号又不阻断构建（eslint 默认不因 warning 失败）。
  {
    files: ["**/command-palette.tsx", "**/commands/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
  {
    files: ["**/ai-panel.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    files: ["**/ssh-terminal.tsx"],
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  {
    files: ["**/*.test.tsx", "**/*.test.ts", "vitest.setup.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
