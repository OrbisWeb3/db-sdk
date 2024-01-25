import {
  IEVMProvider,
  IGenericSignerProvider,
  ISolProvider,
  ITezosProvider,
  SupportedChains,
  SupportedProvider,
} from "../types/providers.js";
import { normalizeEVMProvider } from "./evm.js";
import { normalizeSolProvider } from "./sol.js";
import { normalizeTezosProvider } from "./tezos.js";

export function normalizeProvider({
  provider,
  chain,
}: {
  provider: SupportedProvider;
  chain: SupportedChains;
}): IGenericSignerProvider {
  if ("isGenericSigner" in provider && provider.isGenericSigner === true) {
    return provider as IGenericSignerProvider;
  }

  switch (chain) {
    case SupportedChains.evm:
      return normalizeEVMProvider({ provider: provider as IEVMProvider });
    case SupportedChains.solana:
      return normalizeSolProvider({ provider: provider as ISolProvider });
    case SupportedChains.tezos:
      return normalizeTezosProvider({ provider: provider as ITezosProvider });
    default:
      throw "Unsupported chain " + chain;
  }
}
