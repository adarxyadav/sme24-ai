import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The read-layer boundary (t-006-spec.md D1). The dashboard reads only through
// lib/portal/, and lib/portal/ reaches only the session client and the metric
// contract. Enforced here rather than by convention so `pnpm lint` — already a
// handoff gate — fails on a bad import.
const ENGINE = [
  "@/trigger/*",
  "@/lib/parallel/*",
  "@/lib/extraction/*",
  "@/lib/supabase/service",
  "@trigger.dev/*",
  "ai",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/dashboard/**", "components/dashboard/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/*",
                "!@/lib/portal",
                "!@/lib/portal/*",
                "!@/lib/utils",
                "@/actions/*",
                "@supabase/*",
                ...ENGINE,
              ],
              message:
                "The dashboard reads only through lib/portal/ (t-006-spec.md D1).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["lib/portal/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/runs/*", "!@/lib/runs/metrics", ...ENGINE],
              message:
                "The read layer touches the session client and the metric contract only (t-006-spec.md D1).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Trigger.dev's generated build output — gitignored, and ESLint 9's flat
    // config does not read .gitignore.
    ".trigger/**",
  ]),
]);

export default eslintConfig;
