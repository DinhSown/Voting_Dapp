import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse root .env using only built-in Node modules
function parseEnvFile(filePath: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(filePath, "utf-8")
        .split("\n")
        .flatMap((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) return [];
          const eq = trimmed.indexOf("=");
          if (eq === -1) return [];
          const key = trimmed.slice(0, eq).trim();
          let val = trimmed.slice(eq + 1).trim();
          if (/^["']/.test(val)) val = val.slice(1, -1);
          return [[key, val]];
        })
    );
  } catch {
    return {};
  }
}

const env = parseEnvFile(resolve(__dirname, ".env"));

const sapphireKey = env["SAPPHIRE_PRIVATE_KEY"]
  ? `0x${env["SAPPHIRE_PRIVATE_KEY"].replace(/^0x/, "")}`
  : undefined;

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: { version: "0.8.28" },
      production: {
        version: "0.8.28",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    },
  },
  networks: {
    hardhatMainnet: { type: "edr-simulated", chainType: "l1" },
    localhost: { type: "http", url: "http://127.0.0.1:8545" },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    sapphireTestnet: {
      type: "http",
      url: "https://testnet.sapphire.oasis.io",
      accounts: sapphireKey ? [sapphireKey] : [],
    },
  },
});
