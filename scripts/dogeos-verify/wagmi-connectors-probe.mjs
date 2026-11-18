/**
 * Prints the wagmi connector set the app actually builds, with and without
 * VITE_WALLETCONNECT_PROJECT_ID. Proves the WalletConnect connector is disabled (and the
 * placeholder id is never used) when no project id is configured.
 */
import { createServer } from "vite";

const root = "/Volumes/DEV Projects/Dogechain-Bubblemaps-DogeOS";

const probe = async (label) => {
  const server = await createServer({
    root,
    configFile: `${root}/vite.config.ts`,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });
  try {
    const mod = await server.ssrLoadModule("/wagmi.ts");
    const cfg = mod.config;
    console.log(
      JSON.stringify({
        label,
        chains: cfg.chains?.map((c) => ({ id: c.id, name: c.name })),
        connectors: cfg.connectors?.map((c) => c.id),
        walletConnectEnabled: mod.walletConnectEnabled,
        projectIdEnv: process.env.VITE_WALLETCONNECT_PROJECT_ID ?? null,
      })
    );
  } catch (error) {
    console.log(JSON.stringify({ label, error: String(error?.message ?? error).split("\n")[0] }));
  } finally {
    await server.close();
  }
};

await probe("without-project-id");
process.env.VITE_WALLETCONNECT_PROJECT_ID = "probe-only-not-a-real-id";
await probe("with-project-id");
process.exit(0);
