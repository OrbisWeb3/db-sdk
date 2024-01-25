import { SiwxMessage } from "@didtools/cacao";
import { SupportedChains } from "./providers.js";
import { SignedSiwxMessage } from "./siwx.js";
import { OrbisResources } from "./resources.js";
import { DIDAny } from "./common.js";
import { DID } from "dids";
import { KeyDidSession } from "../auth/keyDid.js";
import { DIDSession } from "did-session";

export type AuthError = { error: string; details?: any };

export type SiwxSession = {
  did: string;
  chain: SupportedChains;
  siwx: {
    message: SignedSiwxMessage;
    resources: Array<OrbisResources>;
    serialized: string;
    signature: string;
  };
};

export type KeyDidAttestation = {
  type: "keyDidSeed";
  seed: string; // hexString
};

export type SiwxAttestation = {
  type: "siwx";
  siwx: SiwxSession["siwx"];
};

export type OrbisSession = {
  authResource: Omit<AuthResource, "siwxResources">;
  authAttestation: KeyDidAttestation | SiwxAttestation;
  session: KeyDidSession | DIDSession;
};

export type SerializedOrbisSession = {
  authResource: Omit<AuthResource, "siwxResources">;
  authAttestation: KeyDidAttestation | SiwxAttestation;
  session: string;
};

export type AuthResource = {
  id: string;
  userFriendlyName: string;
  siwxResources: Array<string>;
  resourceType: OrbisResources;
};

export type AuthOptions = {
  resources: Array<AuthResource>;
  params?: any;
  siwxOverwrites?: Partial<SiwxMessage>;
};

export type AuthUserInformation = {
  did: DIDAny;
  chain: SupportedChains;
  metadata: Record<string, any>;
};

export interface IOrbisAuth {
  readonly orbisAuthId: string;
  readonly chain: SupportedChains;

  getUserInformation(): Promise<AuthUserInformation>;
  authenticateSiwx({
    resources,
    siwxOverwrites,
    params,
  }: AuthOptions): Promise<SiwxSession>;
}

export interface IKeyDidAuth {
  readonly orbisAuthId: "ceramic-did";
  readonly chain: SupportedChains;

  getUserInformation(): Promise<AuthUserInformation>;
  authenticateDid: () => Promise<{ did: DID; session: KeyDidSession }>;
}
