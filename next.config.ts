import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * The production image runs `node server.js` out of `.next/standalone`, and
   * that directory only exists if it is asked for here. Without this the
   * Dockerfile's `COPY --from=builder /app/.next/standalone ./` has nothing to
   * copy, the image build fails, and the deploy step exits non-zero — the
   * running container survives, so the site stays up, but nothing ever ships.
   */
  output: "standalone",
};

export default nextConfig;
