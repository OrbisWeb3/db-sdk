import { SiwTezosMessage } from "@didtools/cacao";
import { normalizeProvider } from "../providers/index.js";
import {
  AuthUserInformation,
  AuthOptions,
  IOrbisAuth,
  SiwxSession,
} from "../types/auth.js";
import {
  ITezosProvider,
  IGenericSignerProvider,
  SupportedChains,
} from "../types/providers.js";
import { createOrbisSiwxMessage } from "../siwx/index.js";
import { SignedSiwxMessage } from "../types/siwx.js";
import { DIDPkh } from "../types/common.js";

export class OrbisTezosAuth implements IOrbisAuth {
  orbisAuthId = "orbis-tezos";
  chain = SupportedChains.tezos;
  #provider: IGenericSignerProvider;

  constructor(provider: ITezosProvider | IGenericSignerProvider) {
    this.#provider = normalizeProvider({ provider, chain: this.chain });
  }

  async getUserInformation(): Promise<AuthUserInformation> {
    await this.#provider.connect();

    const address = await this.#provider.getAddress();
    const publicKey = await (this.#provider as any).getPublicKey();
    // mainnet chain NetXdQprcVkpaWU
    // devnet chain NetXm8tYqnMWky1
    const did: DIDPkh = `did:pkh:tezos:NetXdQprcVkpaWU:${address}`;
    const chain = this.chain;

    return {
      did,
      chain,
      metadata: {
        address,
        publicKey,
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

    const siwtMessage = (await createOrbisSiwxMessage({
      provider: this.#provider,
      chain: this.chain,
      resources,
      siwxOverwrites,
    })) as SiwTezosMessage;

    const messageToSign = siwtMessage.signMessage();

    const signature = await this.#provider.signMessage(messageToSign);
    siwtMessage.signature = signature;

    return {
      chain: this.chain,
      did: did,
      siwx: {
        message: siwtMessage as SignedSiwxMessage,
        serialized: messageToSign,
        signature,
        resources: resources.map((v) => v.resourceType),
      },
    };
  }
}
