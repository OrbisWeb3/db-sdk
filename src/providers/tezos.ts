import {
  IGenericSignerProvider,
  ITezosProvider,
  SupportedChains,
} from "../types/index.js";
import { catchError } from "../util/tryit.js";

class OrbisTezosProvider implements IGenericSignerProvider {
  readonly genericSignerId = "orbis-tezos";
  readonly chain = SupportedChains.tezos;
  #provider: ITezosProvider;

  constructor(provider: ITezosProvider) {
    this.#provider = provider;
  }

  async connect(): Promise<void> {
    if (typeof this.#provider.checkPermissions === "function") {
      const [active] = await catchError(() =>
        this.#provider.getActiveAccount()
      );
      if (active && active.address) {
        const [connected] = await catchError(() =>
          (this.#provider as any).checkPermissions("sign_payload_request")
        );
        if (connected) {
          return;
        }
      }
    }

    if (typeof this.#provider.requestPermissions === "function") {
      return this.#provider.requestPermissions({
        network: {
          type: "mainnet",
        },
      });
    }

    return;
  }

  async getAddress(): Promise<string> {
    const { address } = await this.#provider.getActiveAccount();
    return address;
  }

  async getPublicKey(): Promise<string> {
    const { publicKey } = await this.#provider.getActiveAccount();
    return publicKey;
  }

  async signMessage(message: string): Promise<string> {
    const signature = await this.#provider.requestSignPayload({
      signingType: "micheline",
      payload: message,
    });

    if (typeof signature === "string") {
      return signature;
    }
    return signature.signature;
  }
}

export function normalizeTezosProvider({
  provider,
}: {
  provider: ITezosProvider;
}): IGenericSignerProvider {
  return new OrbisTezosProvider(provider);
}
