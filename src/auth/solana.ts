import { SiwsMessage, SiwxMessage } from "@didtools/cacao";
import { normalizeProvider } from "../providers/index.js";
import {
  AuthUserInformation,
  AuthOptions,
  ISiwxAuth,
  SignedSiwx,
} from "../types/auth.js";
import {
  ISolProvider,
  IGenericSignerProvider,
  SupportedChains,
} from "../types/providers.js";
import { createOrbisSiwxMessage } from "../siwx/index.js";
import { SignedSiwxMessage } from "../types/siwx.js";
import { DIDPkh } from "../types/common.js";
import { DID } from "dids";
import { DIDSession } from "did-session";
import { authenticateDidWithSiwx } from "./common.js";

export class OrbisSolanaAuth implements ISiwxAuth {
  orbisAuthId = "orbis-solana";
  chain = SupportedChains.solana;
  #provider: IGenericSignerProvider;

  constructor(provider: ISolProvider | IGenericSignerProvider) {
    this.#provider = normalizeProvider({ provider, chain: this.chain });
  }

  get provider() {
    return this.#provider;
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

  async signSiwx(siwx: SiwxMessage): Promise<SignedSiwx> {
    await this.#provider.connect();

    const user = await this.getUserInformation();

    const siwsMessage = new SiwsMessage(siwx);
    const messageToSign = siwsMessage.toMessage();

    const signature = await this.#provider.signMessage(messageToSign);
    siwsMessage.signature = signature;

    return {
      chain: this.chain,
      user,
      siwx: {
        message: siwsMessage as SignedSiwxMessage,
        serialized: messageToSign,
        signature,
      },
    };
  }

  async authenticateDid({ siwxOverwrites, params }: AuthOptions = {}): Promise<{
    did: DID;
    session: DIDSession;
  }> {
    const { did, session } = await authenticateDidWithSiwx({
      authenticator: this,
      siwxOverwrites,
    });

    return {
      did,
      session,
    };
  }
}
