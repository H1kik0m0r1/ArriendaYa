import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.56.1", "localhost"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }, { protocol: "https", hostname: "i.pravatar.cc" }],
  },
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        condition: { not: "foreign" },
        as: "*.css",
      },
    },
  },
  webpack: (config) => {
    const patchCssRules = (rules: unknown[]) => {
      for (const item of rules) {
        if (!item || typeof item !== "object") continue;
        const rule = item as {
          oneOf?: unknown[];
          use?: unknown;
          test?: RegExp;
        };
        if (Array.isArray(rule.oneOf)) {
          patchCssRules(rule.oneOf);
        }
        if (
          Array.isArray(rule.use) &&
          rule.test instanceof RegExp &&
          rule.test.test("globals.css") &&
          !rule.test.test("globals.module.css")
        ) {
          rule.use.push({
            loader: "@tailwindcss/turbopack",
            options: {},
          });
        }
      }
    };
    if (Array.isArray(config.module?.rules)) {
      patchCssRules(config.module.rules);
    }
    return config;
  },
};

export default nextConfig;
