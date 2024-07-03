import { StreamID } from "@ceramicnetwork/streamid";
import { DIDAny } from "./common.js";
import { ModelInstanceDocument } from "@ceramicnetwork/stream-model-instance";

import { SupportedChains } from "./providers.js";
import { ISiwxAuth, AuthUserInformation, IKeyDidAuth } from "./auth.js";
import { SiwxMessage } from "@didtools/cacao";
import { KeyDidSession } from "../auth/keyDid.js";
import { DIDSession } from "did-session";

export type CeramicDocument = {
  id: string;
  content: Record<string, any>;
  controller: DIDAny;
  model: string;
  context?: string;
  metadata: Record<string, any>;
};

export type NewCeramicDocument = {
  content: Record<string, any>;
  model: StreamID | string;
  context?: StreamID | string;
  metadata?: Record<string, any>;
};

export interface ICeramicStorage {
  id: string;
  userFriendlyName: string;
  supportedChains: Array<SupportedChains>;

  user?: AuthUserInformation;
  session: KeyDidSession | DIDSession | false;

  connect(params?: any): Promise<void>;
  authorize({
    authenticator,
    siwxOverwrites,
  }: {
    authenticator: ISiwxAuth | IKeyDidAuth;
    siwxOverwrites?: Partial<SiwxMessage>;
  }): Promise<any>;

  setSession({
    session,
    did,
  }: {
    session: string;
    did?: DIDAny;
  }): Promise<KeyDidSession | DIDSession>;
  clearSession(): Promise<void>;
  assertCurrentUser(did: DIDAny): Promise<boolean>;

  getDocument(id: string): Promise<CeramicDocument>;
  createDocument(params: NewCeramicDocument): Promise<{ id: string }>;
  updateDocument(
    id: string,
    params: Record<string, any>
  ): Promise<{ id: string }>;
  updateDocumentBySetter(
    id: string,
    setter: (document: ModelInstanceDocument) => Promise<Record<string, any>>
  ): Promise<CeramicDocument>;
}
