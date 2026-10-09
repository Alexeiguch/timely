import type { NextConfig } from "next";
import { securityHeaders } from "./security-headers";
const config: NextConfig = {
  transpilePackages: [
    "@timely/auth",
    "@timely/db",
    "@timely/contracts",
    "@timely/domain",
    "@timely/sync",
    "@timely/design",
    "@timely/i18n",
  ],
  serverExternalPackages: ["postgres"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
export default config;
