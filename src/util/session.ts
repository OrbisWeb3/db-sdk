import { DIDSession } from "did-session";
import { decodeBase64 } from "./conversion.js";
import { catchError } from "./tryit.js";
import { KeyDidSession, OrbisKeyDidAuth } from "../auth/keyDid.js";
import { OrbisConnectResult } from "../types/methods.js";
import { SupportedChains } from "../types/providers.js";
import { DIDAny } from "../types/common.js";
import { Cacao } from "@didtools/cacao";
import { AuthUserInformation } from "../types/auth.js";

export type DecodedKeyDidSession = {
  sessionType: "key-did";
  session: KeyDidSession;
  serialized: string;
};

export type DecodedCacaoSession = {
  sessionType: "cacao-did";
  session: DIDSession;
  serialized: string;
};

export const parseSerializedSession = async (
  session: string
): Promise<DecodedKeyDidSession | DecodedCacaoSession> => {
  const [decoded, error] = await catchError(() =>
    JSON.parse(decodeBase64(session))
  );

  if (error) {
    /**
     * Attempt legacy session parsing
     */
    const [legacySession, _] = await catchError(() => JSON.parse(session));

    if (!legacySession || !legacySession?.session?.session) {
      throw (
        "[parseSerializedSession] Unable to decode the provided session " +
        error
      );
    }

    console.info(
      `[parseSerializedSession] Attempting legacy session parsing, for sessions created before 0.0.40-alpha.`
    );

    // If legacy serialized KeyDidSession
    const serialized: string = legacySession.session.session;
    if (serialized.startsWith("did:key:session")) {
      const seed = serialized.split(":").pop() as string;
      const keyDid = await OrbisKeyDidAuth.fromSeed(seed);
      const { session } = await keyDid.authenticateDid();
      return parseSerializedSession(session.serialize());
    }

    // Assume the session is a serialized DIDSession
    return parseSerializedSession(serialized);
  }

  if (decoded.sessionType === "key-did") {
    return {
      sessionType: "key-did",
      session: new KeyDidSession(decoded.seed, decoded.did),
      serialized: session,
    };
  }

  return {
    sessionType: "cacao-did",
    session: await DIDSession.fromSession(session),
    serialized: session,
  };
};

const didToChainEnum = {
  eip155: SupportedChains.evm,
  solana: SupportedChains.solana,
  tezos: SupportedChains.tezos,
} as Record<string, SupportedChains>;

export const parseUserFromDid = (did: DIDAny): AuthUserInformation => {
  const [_did, _pkh, chain, network, address] = did.split(":");

  return {
    did,
    chain: didToChainEnum[chain],
    metadata: {
      address,
    },
  };
};

const parseUserFromCacao = (cacao: Cacao): AuthUserInformation => {
  const did = cacao.p.iss as DIDAny;

  return parseUserFromDid(did);
};

export const buildOrbisSession = (
  session: KeyDidSession | DIDSession
): OrbisConnectResult => {
  if ("seed" in session) {
    return {
      auth: {
        attestation: {
          type: "keyDidSeed",
          seed: session.seed,
        },
        session,
        serializedSession: session.serialize(),
      },
      user: {
        did: session.did,
        chain: SupportedChains.evm,
        metadata: {
          publicKey: session.did.split(":").pop(),
        },
      },
      chain: SupportedChains.evm,
    };
  }

  const user = parseUserFromCacao(session.cacao);

  return {
    auth: {
      attestation: {
        type: "cacao",
        cacao: session.cacao,
      },
      session,
      serializedSession: session.serialize(),
    },
    user,
    chain: user.chain,
  };
};
