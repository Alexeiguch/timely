import type { NextConfig } from 'next';
const config: NextConfig = { transpilePackages: ['@timely/auth','@timely/db','@timely/contracts','@timely/domain','@timely/sync','@timely/design'], serverExternalPackages: ['postgres'] };
export default config;
