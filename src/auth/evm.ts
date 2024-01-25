import { SiweMessage } from "@didtools/cacao";
import { normalizeProvider } from "../providers/index.js";
import {
  AuthUserInformation,
  AuthOptions,
  IOrbisAuth,
  SiwxSession,
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

export class OrbisEVMAuth implements IOrbisAuth {
  orbisAuthId = "orbis-evm";
  chain = SupportedChains.ethereum;
  #provider: IGenericSignerProvider;

  constructor(provider: IEVMProvider | IGenericSignerProvider) {
    this.#provider = normalizeProvider({ provider, chain: this.chain });
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

  async authenticateSiwx({
    resources,
    siwxOverwrites,
    params,
  }: AuthOptions): Promise<SiwxSession> {
    await this.#provider.connect();

    const { did } = await this.getUserInformation();

    const siweMessage = (await createOrbisSiwxMessage({
      provider: this.#provider,
      chain: this.chain,
      resources,
      siwxOverwrites,
    })) as SiweMessage;

    const messageToSign = siweMessage.signMessage();

    const signature = await this.#provider.signMessage(messageToSign);
    siweMessage.signature = signature;

    return {
      chain: this.chain,
      did: did,
      siwx: {
        message: siweMessage as SignedSiwxMessage,
        serialized: messageToSign,
        signature,
        resources: resources.map((v) => v.resourceType),
      },
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
