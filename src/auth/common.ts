import { DIDSession, createDIDCacao, createDIDKey } from "did-session";
import {
  Cacao,
  SiwTezosMessage,
  SiweMessage,
  SiwsMessage,
  SiwxMessage,
} from "@didtools/cacao";
import { createOrbisSiwxMessage, SupportedChains } from "../index.js";
import { OrbisError } from "../util/results.js";
import { ISiwxAuth } from "../types/auth.js";
import { OrbisKeyDidAuth } from "./keyDid.js";

export const cacaoFromMessage = (
  message: SiwxMessage,
  chain: SupportedChains
) => {
  switch (chain) {
    case SupportedChains.evm:
      return Cacao.fromSiweMessage(message as SiweMessage);
    case SupportedChains.solana:
      return Cacao.fromSiwsMessage(message as SiwsMessage);
    case SupportedChains.tezos:
      return Cacao.fromSiwTezosMessage(message as SiwTezosMessage);
    default:
      throw new OrbisError("Unsupported chain " + chain);
  }
};

export const authenticateDidWithSiwx = async ({
  authenticator,
  siwxOverwrites,
}: {
  authenticator: ISiwxAuth;
  siwxOverwrites?: Partial<SiwxMessage>;
}) => {
  const keySeed = (await OrbisKeyDidAuth.generateSeed("uint8")) as Uint8Array;
  const didKey = await createDIDKey(keySeed);

  const user = await authenticator.getUserInformation();

  const siwxMessage = await createOrbisSiwxMessage({
    siwxOverwrites: {
      ...siwxOverwrites,
      uri: didKey.id,
    },
    chain: authenticator.chain,
    provider: authenticator.provider,
  });

  const session = await authenticator.signSiwx(siwxMessage);

  if (user.chain === SupportedChains.tezos) {
    const siwx = session.siwx.message;
    siwx.signature = siwx.signature + user.metadata.publicKey;
    session.siwx.signature = siwx.signature;
  }

  const cacao = cacaoFromMessage(session.siwx.message, user.chain);

  const didSession = new DIDSession({
    keySeed,
    cacao,
    did: await createDIDCacao(didKey, cacao),
  });

  return {
    did: didSession.did,
    session: didSession,
  };
};
