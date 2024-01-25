import { SiwsMessage } from "@didtools/cacao";
import { normalizeProvider } from "../providers/index.js";
import {
  AuthUserInformation,
  AuthOptions,
  IOrbisAuth,
  SiwxSession,
} from "../types/auth.js";
import {
  ISolProvider,
  IGenericSignerProvider,
  SupportedChains,
} from "../types/providers.js";
import { createOrbisSiwxMessage } from "../siwx/index.js";
import { SignedSiwxMessage } from "../types/siwx.js";
import { DIDPkh } from "../types/common.js";

export class OrbisSolanaAuth implements IOrbisAuth {
  orbisAuthId = "orbis-solana";
  chain = SupportedChains.solana;
  #provider: IGenericSignerProvider;

  constructor(provider: ISolProvider | IGenericSignerProvider) {
    this.#provider = normalizeProvider({ provider, chain: this.chain });
  }

  async getUserInformation(): Promise<AuthUserInformation> {
    await this.#provider.connect();

    const address = await this.#provider.getAddress();
    // mainnet chain 5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp
    // testnet chain 4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z
    const did: DIDPkh = `did:pkh:solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:${address}`;
    const chain = this.chain;

    return {
      did,
      chain,
      metadata: {
        address,
      },
    };
  }

  async authenticateSiwx({
    resources,
    siwxOverwrites,
    params,
  }: AuthOptions): Promise<SiwxSession> {
    await this.#provider.connect();

    const { did } = await this.getUserInformation();

    const siwsMessage = (await createOrbisSiwxMessage({
      provider: this.#provider,
      chain: this.chain,
      resources,
      siwxOverwrites,
    })) as SiwsMessage;

    const messageToSign = siwsMessage.toMessage();
    const signature = await this.#provider.signMessage(messageToSign);
    siwsMessage.signature = signature;

    return {
      chain: this.chain,
      did: did,
      siwx: {
        message: siwsMessage as SignedSiwxMessage,
        serialized: messageToSign,
        signature,
        resources: resources.map((v) => v.resourceType),
      },
    };
  }
}
