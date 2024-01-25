import {
  IGenericSignerProvider,
  ISolProvider,
  SupportedChains,
} from "../types/index.js";
import { toString } from "uint8arrays";

class OrbisSolProvider implements IGenericSignerProvider {
  readonly genericSignerId = "orbis-sol";
  readonly chain = SupportedChains.solana;
  #provider: ISolProvider;

  constructor(provider: ISolProvider) {
    this.#provider = provider;
  }

  async connect(): Promise<void> {
    if (
      this.#provider.connected === true ||
      this.#provider.isConnected === true
    )
      return;
    await this.#provider.connect();
  }

  async getAddress(): Promise<string> {
    const publicKey = this.#provider.publicKey;
    if (typeof publicKey === "string") {
      return publicKey;
    }
    return publicKey.toString();
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    const encoder = new TextEncoder();
    const encodedMessage =
      typeof message === "string" ? encoder.encode(message) : message;
    const signature = await this.#provider.signMessage(encodedMessage);

    if (signature instanceof Uint8Array)
      return toString(signature, "base58btc");
    return toString(signature.signature, "base58btc");
  }
}

export function normalizeSolProvider({
  provider,
}: {
  provider: ISolProvider;
}): IGenericSignerProvider {
  return new OrbisSolProvider(provider);
}
