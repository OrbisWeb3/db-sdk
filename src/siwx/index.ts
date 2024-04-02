import { randomString } from "@stablelib/random";
import { IGenericSignerProvider, SupportedChains } from "../types/providers.js";
import { SiwxMessageToSign } from "../types/siwx.js";
import {
  SiweMessage,
  SiwStacksMessage,
  SiwTezosMessage,
  SiwsMessage,
  SiwxMessage,
} from "@didtools/cacao";
import { CHAIN_NAMESPACE_MAP, THREE_MONTHS } from "../util/const.js";
import { AuthResource } from "../types/auth.js";

type CreateSiwxMessageParams = {
  siwxOpts: Partial<SiwxMessage>;
} & ({ provider: IGenericSignerProvider } | { chain: SupportedChains });

type CreateOrbisSiwxMessageParams = {
  siwxOverwrites?: Partial<SiwxMessage>;
  resources: Array<AuthResource>;
} & (
  | { provider: IGenericSignerProvider }
  | { address: string; chain: SupportedChains }
);

export async function createOrbisSiwxMessage(
  params: CreateOrbisSiwxMessageParams
) {
  if (!params.resources || !params.resources.length)
    throw "No resources provided for the SIWX message, provide at least one resource.";

  const siwxOpts = params.siwxOverwrites || {};
  const address =
    "address" in params ? params.address : await params.provider.getAddress();
  const chain = "chain" in params ? params.chain : params.provider.chain;

  const statement = `Give this application access to some of your data on ${params.resources
    .map((v) => v.userFriendlyName)
    .join(", ")}.`;

  const domain =
    siwxOpts.domain ||
    (typeof window !== "undefined" && window?.location?.host) ||
    "localhost";

  if (!domain) {
    throw 'No "domain" has been set';
  }

  const uri =
    siwxOpts.uri ||
    (typeof window !== "undefined" && window?.location?.href) ||
    "http://localhost";

  if (!uri) {
    throw 'No "uri" has been set';
  }

  const newSiwxOpts = {
    domain,
    address,
    statement: statement,
    uri,
    version: "1",
    nonce: siwxOpts.nonce || randomString(10),
    issuedAt: siwxOpts.issuedAt || new Date().toISOString(),
    expirationTime:
      siwxOpts.expirationTime ||
      new Date(Date.now() + THREE_MONTHS).toISOString(),
    chainId: siwxOpts.chainId || CHAIN_NAMESPACE_MAP[chain].chainId,
    resources:
      siwxOpts.resources ||
      params.resources.reduce(
        (acc: Array<string>, v) => [...acc, ...v.siwxResources],
        []
      ),
    ...siwxOpts,
  } as Partial<SiwxMessage>;

  return createSiwxMessage({ siwxOpts: newSiwxOpts, chain });
}

export function createSiwxMessage(
  params: CreateSiwxMessageParams
): SiwxMessageToSign {
  const chain = "chain" in params ? params.chain : params.provider.chain;
  const siwxOpts = params.siwxOpts;

  switch (chain) {
    case SupportedChains.evm:
      // TODO: enable lowercased address if Lit supports it
      return new SiweMessage(siwxOpts);
    case SupportedChains.solana:
      return new SiwsMessage(siwxOpts);
    case SupportedChains.tezos:
      return new SiwTezosMessage(siwxOpts);
    case SupportedChains.stacks:
      return new SiwStacksMessage(siwxOpts);
    default:
      throw "Unsupported chain " + chain;
  }
}
