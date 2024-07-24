import { SiweMessage, SiwxMessage } from "@didtools/cacao";
import { normalizeProvider } from "../providers/index.js";
import {
  AuthUserInformation,
  AuthOptions,
  ISiwxAuth,
  SignedSiwx,
} from "../types/auth.js";
import {
  IEVMProvider,
  IGenericSignerProvider,
  SupportedChains,
} from "../types/providers.js";
import { createOrbisSiwxMessage } from "../siwx/index.js";
import { SignedSiwxMessage } from "../types/siwx.js";
import { DIDPkh } from "../types/common.js";
import { normalizeEVMProvider } from "../providers/evm.js";
import { DID } from "dids";
import { DIDSession } from "did-session";
import { authenticateDidWithSiwx } from "./common.js";

export class OrbisEVMAuth implements ISiwxAuth {
  orbisAuthId = "orbis-evm";
  chain = SupportedChains.ethereum;
  #provider: IGenericSignerProvider;

  constructor(provider: IEVMProvider | IGenericSignerProvider) {
    this.#provider = normalizeProvider({ provider, chain: this.chain });
  }

  get provider() {
    return this.#provider;
  }

  async getUserInformation(): Promise<AuthUserInformation> {
    await this.#provider.connect();

    const address = await this.#provider.getAddress();
    const did: DIDPkh = `did:pkh:eip155:1:${address.toLowerCase()}`;
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

    const siweMessage = new SiweMessage(siwx);
    const messageToSign = siweMessage.signMessage();

    const signature = await this.#provider.signMessage(messageToSign);
    siweMessage.signature = signature;

    return {
      user,
      chain: this.chain,
      siwx: {
        message: siweMessage as SignedSiwxMessage,
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

export class OrbisWeb3AuthEVMAuth extends OrbisEVMAuth {
  orbisAuthId = "orbis-evm-web3auth";

  constructor(provider: IEVMProvider) {
    const sanitizedProvider = Object.assign(
      normalizeEVMProvider({ provider }),
      { connect: async () => {} }
    );
    super(sanitizedProvider);
  }
}
