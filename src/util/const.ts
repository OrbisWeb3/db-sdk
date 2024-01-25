import { SupportedChains } from "../types/providers.js";

export const daysToMiliseconds = (days: number): number =>
  days * 24 * 60 * 60 * 1000;
export const ONE_WEEK = daysToMiliseconds(7);
export const THREE_MONTHS = daysToMiliseconds(90);
export const ONE_DAY = daysToMiliseconds(1);

export const CHAIN_NAMESPACE_MAP = {
  [SupportedChains.evm]: {
    namespace: "eip155",
    chainId: "1",
  },
  [SupportedChains.solana]: {
    namespace: "solana",
    chainId: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  },
  [SupportedChains.tezos]: {
    namespace: "tezos",
    chainId: "NetXdQprcVkpaWU",
  },
  [SupportedChains.stacks]: {
    namespace: "stacks",
    chainId: "1",
  },
} as const;

export const LOCALSTORAGE_KEYS = {
  session: "orbis:session",
} as const;

export const VERIFIED_DIDS = {
  ORBIS_NODE: "did:pkh:eip155:1:0xdbcf111ca51572e2f924587faeab857f1e3b824f",
} as const;
