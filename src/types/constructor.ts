import type { CeramicClient } from "@ceramicnetwork/http-client";
import { StoreConfig } from "./util.js";

export type CeramicConfig = { gateway: string } | { client: CeramicClient };

type OrbisNodeConfig = { gateway: string; key?: string; env?: string };

// Use an array for CeramicConfig
export type OrbisConfig = {
  nodes: Array<OrbisNodeConfig>;
  ceramic: CeramicConfig;
  localStore?: StoreConfig;
};
