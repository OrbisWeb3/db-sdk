import { SiwTezosMessage, SiwxMessage } from "@didtools/cacao";
import { normalizeProvider } from "../providers/index.js";
import {
  AuthUserInformation,
  AuthOptions,
  ISiwxAuth,
  SignedSiwx,
} from "../types/auth.js";
import {
  ITezosProvider,
  IGenericSignerProvider,
  SupportedChains,
} from "../types/providers.js";
import { createOrbisSiwxMessage } from "../siwx/index.js";
import { SignedSiwxMessage } from "../types/siwx.js";
import { DIDPkh } from "../types/common.js";
import { DID } from "dids";
import { DIDSession } from "did-session";
import { authenticateDidWithSiwx } from "./common.js";

export class OrbisTezosAuth implements ISiwxAuth {
  orbisAuthId = "orbis-tezos";
  chain = SupportedChains.tezos;
  #provider: IGenericSignerProvider;

  constructor(provider: ITezosProvider | IGenericSignerProvider) {
    this.#provider = normalizeProvider({ provider, chain: this.chain });
  }

  get provider() {
    return this.#provider;
  }

  async getUserInformation(): Promise<AuthUserInformation> {
    await this.#provider.connect();

    const address = await this.#provider.getAddress();
    // mainnet chain NetXdQprcVkpaWU
    // devnet chain NetXm8tYqnMWky1
    const did: DIDPkh = `did:pkh:tezos:NetXdQprcVkpaWU:${address}`;
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

    const siwtMessage = new SiwTezosMessage(siwx);
    const messageToSign = siwtMessage.signMessage();

    const signature = await this.#provider.signMessage(messageToSign);
    siwtMessage.signature = signature;

    return {
      chain: this.chain,
      user,
      siwx: {
        message: siwtMessage as SignedSiwxMessage,
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
