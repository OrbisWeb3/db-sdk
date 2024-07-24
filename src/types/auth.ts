import { Cacao, SiwxMessage } from "@didtools/cacao";
import { IGenericSignerProvider, SupportedChains } from "./providers.js";
import { SignedSiwxMessage } from "./siwx.js";
import { DIDAny } from "./common.js";
import { DID } from "dids";
import { KeyDidSession } from "../auth/keyDid.js";
import { DIDSession } from "did-session";

export type AuthError = { error: string; details?: any };

export type SignedSiwx = {
  user: AuthUserInformation;
  chain: SupportedChains;
  siwx: {
    message: SignedSiwxMessage;
    serialized: string;
    signature: string;
  };
};

export type KeyDidAttestation = {
  type: "keyDidSeed";
  seed: string; // hexString
};

export type CacaoAttestation = {
  type: "cacao";
  cacao: Cacao;
};

export type AuthUserInformation = {
  did: DIDAny;
  chain: SupportedChains;
  metadata: Record<string, any>;
};

export type OrbisAuthSession = {
  attestation: KeyDidAttestation | CacaoAttestation;
  session: DIDSession | KeyDidSession;
  serializedSession: string;
};

export type AuthOptions = {
  params?: any;
  siwxOverwrites?: Partial<SiwxMessage>;
};

export interface IDidAuth {
  readonly orbisAuthId: string;
  readonly chain: SupportedChains;

  getUserInformation(): Promise<AuthUserInformation>;
  authenticateDid: (
    authParams?: AuthOptions
  ) => Promise<{ did: DID; session: DIDSession | KeyDidSession }>;
}

export interface ISiwxAuth extends IDidAuth {
  provider: IGenericSignerProvider;
  signSiwx(siwx: SiwxMessage): Promise<SignedSiwx>;
}
