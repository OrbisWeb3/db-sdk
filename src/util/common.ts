import { SupportedChains } from "../index.js";

export type DIDAddress = { address: string; chain: SupportedChains };

const namespaceToNetwork: Record<string, SupportedChains> = {
  eip155: SupportedChains.evm,
  solana: SupportedChains.solana,
  tezos: SupportedChains.tezos,
  stacks: SupportedChains.stacks,
};

export const didToAddress = (did: string): DIDAddress | { error: string } => {
  const parsed = did.split(":");
  if (parsed.length !== 5)
    return {
      error: "Invalid did type, only DID PKH format is supported.",
    };

  if (!(parsed[2] in namespaceToNetwork)) {
    return {
      error: `Network namespace ${parsed[2]} is not a supported Orbis network.`,
    };
  }

  return {
    chain: namespaceToNetwork[parsed[2]],
    address: parsed[4],
  };
};

export const didsToAddresses = (dids: Array<string>): Array<DIDAddress> => {
  const deduplicated = Array.from(new Set(dids.filter((v) => v)));
  const parsedDIDs = [];

  for (const did of deduplicated) {
    const didAddress = didToAddress(did);
    if ("error" in didAddress) continue;
    parsedDIDs.push(didAddress);
  }

  return parsedDIDs;
};
