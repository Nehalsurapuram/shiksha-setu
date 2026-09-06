import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Document parsers are loaded through Node's own `require` rather than being
   * bundled.
   *
   * pdfjs-dist parses correctly under plain Node but fails once the bundler
   * rewrites its internals — it resolves workers and standard-font data
   * relative to its own package layout, which bundling breaks. mammoth is
   * listed for the same reason: both are read at request time on the server
   * and never reach the browser.
   */
  serverExternalPackages: ["pdfjs-dist", "mammoth"],
};

export default nextConfig;
