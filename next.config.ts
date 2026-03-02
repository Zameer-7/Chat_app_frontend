import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/", destination: "/chat" },
      { source: "/rooms/:roomId", destination: "/chat/rooms/:roomId" },
      { source: "/dm/:userId", destination: "/chat/dms/:userId" },
    ];
  },
};

export default nextConfig;
