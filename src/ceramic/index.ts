import { CeramicClient } from "@ceramicnetwork/http-client";
import { ModelInstanceDocument } from "@ceramicnetwork/stream-model-instance";
import { Model, ModelDefinition } from "@ceramicnetwork/stream-model";

import {
  OrbisDocument,
  IOrbisStorage,
  NewOrbisDocument,
} from "../types/ceramic.js";
import { CeramicConfig } from "../types/constructor.js";
import { DIDSession, createDIDCacao, createDIDKey } from "did-session";
import { randomBytes } from "crypto";
import {
  Cacao,
  SiwTezosMessage,
  SiweMessage,
  SiwsMessage,
  SiwxMessage,
} from "@didtools/cacao";
import { SupportedChains, OrbisResources, DIDAny } from "../index.js";
import { OrbisError } from "../util/results.js";
import {
  AuthUserInformation,
  IKeyDidAuth,
  IOrbisAuth,
  OrbisSession,
  SerializedOrbisSession,
} from "../types/auth.js";
import { KeyDidSession, OrbisKeyDidAuth } from "../auth/keyDid.js";
import { StreamID } from "@ceramicnetwork/streamid";

export class CeramicStorage implements IOrbisStorage {
  id = "ceramic";
  userFriendlyName = "Ceramic Network";
  supportedChains = [
    SupportedChains.evm,
    SupportedChains.solana,
    SupportedChains.tezos,
    SupportedChains.stacks,
  ];

  siwxResources = ["ceramic://*"];

  #session?: OrbisSession;
  #user?: AuthUserInformation;
  client: CeramicClient;

  constructor(params: CeramicConfig) {
    if ("client" in params) {
      this.client = params.client;
    } else {
      this.client = new CeramicClient(params.gateway);
    }
  }

  get user() {
    return this.#user;
  }

  get did() {
    return this.client.did;
  }

  get session(): SerializedOrbisSession | false {
    if (!this.#session) {
      return false;
    }

    return {
      authAttestation: this.#session?.authAttestation,
      authResource: this.#session?.authResource,
      session: this.#session?.session.serialize(),
    };
  }

  get didSession(): DIDSession | KeyDidSession | false {
    if (!this.#session) {
      return false;
    }

    return this.#session.session;
  }

  async connect(): Promise<void> {
    return;
  }

  #cacaoFromMessage(message: SiwxMessage, chain: SupportedChains) {
    switch (chain) {
      case SupportedChains.evm:
        return Cacao.fromSiweMessage(message as SiweMessage);
      case SupportedChains.solana:
        return Cacao.fromSiwsMessage(message as SiwsMessage);
      case SupportedChains.tezos:
        return Cacao.fromSiwTezosMessage(message as SiwTezosMessage);
      default:
        throw new OrbisError("Unsupported chain " + chain, {
          supportedChains: this.supportedChains,
        });
    }
  }

  async authorize({
    authenticator,
    siwxOverwrites,
  }: {
    authenticator: IOrbisAuth | IKeyDidAuth;
    siwxOverwrites?: Partial<SiwxMessage>;
  }): Promise<OrbisSession> {
    if (
      !("authenticateSiwx" in authenticator) &&
      !("authenticateDid" in authenticator)
    ) {
      throw "Unsupported auth method, missing authenticateSiwx or authenticateDid";
    }

    const userInformation = await authenticator.getUserInformation();
    if (!this.supportedChains.includes(userInformation.chain)) {
      throw new OrbisError(
        "[Ceramic] Unsupported authentication method. Chain not supported " +
          userInformation.chain,
        { supportedChains: this.supportedChains }
      );
    }

    if ("authenticateDid" in authenticator) {
      const { did, session } = await authenticator.authenticateDid();

      const keyDidSession = session;
      this.client.setDID(did);
      this.#user = userInformation;

      this.#session = {
        authResource: {
          id: this.id,
          userFriendlyName: this.userFriendlyName,
          resourceType: OrbisResources.storage,
        },
        authAttestation: {
          type: "keyDidSeed",
          seed: keyDidSession.seed,
        },
        session: keyDidSession,
      };

      return this.#session;
    }

    const keySeed = randomBytes(32);
    const didKey = await createDIDKey(keySeed);

    const session = await (authenticator as IOrbisAuth).authenticateSiwx({
      resources: [
        {
          id: this.id,
          resourceType: OrbisResources.storage,
          userFriendlyName: this.userFriendlyName,
          siwxResources: this.siwxResources,
        },
      ],
      siwxOverwrites: {
        ...siwxOverwrites,
        uri: didKey.id,
        ...((userInformation.chain === SupportedChains.evm && {
          address: userInformation.metadata.address.toLowerCase(),
        }) ||
          {}),
      },
    });

    if (userInformation.chain === SupportedChains.tezos) {
      const siwx = session.siwx.message;
      siwx.signature = siwx.signature + userInformation.metadata.publicKey;
      session.siwx.signature = siwx.signature;
    }

    const cacao = this.#cacaoFromMessage(
      session.siwx.message,
      userInformation.chain
    );
    const did = await createDIDCacao(didKey, cacao);

    const didSession = new DIDSession({ keySeed, cacao, did });
    this.client.setDID(didSession.did);
    this.#user = userInformation;

    this.#session = {
      authResource: {
        id: this.id,
        userFriendlyName: this.userFriendlyName,
        resourceType: OrbisResources.storage,
      },
      authAttestation: {
        type: "siwx",
        siwx: session.siwx,
      },
      session: didSession,
    };

    return this.#session;
  }

  async setSession({
    user,
    session,
  }: {
    user: AuthUserInformation;
    session: SerializedOrbisSession;
  }): Promise<void> {
    if (session.authResource.id !== this.id) {
      throw new OrbisError("Session authResource mismatch.", {
        sessionAuthResource: session.authResource.id,
        authResource: this.id,
      });
    }

    const serializedSession = session.session;

    if (session.authAttestation.type === "keyDidSeed") {
      const keydid = await OrbisKeyDidAuth.fromSession(serializedSession);
      const keyUser = await keydid.getUserInformation();
      if (user.did !== keyUser.did) {
        this.clearSession();
        throw new OrbisError("did mismatch", { keyUser, user });
      }

      const { session: parsedSession, did } = await keydid.authenticateDid();

      this.client.setDID(did);
      this.#user = user;

      this.#session = {
        authAttestation: session.authAttestation,
        authResource: session.authResource,
        session: parsedSession,
      };

      return;
    }

    const parsedSession = await DIDSession.fromSession(serializedSession);

    if (parsedSession.id !== user.did) {
      this.clearSession();
      throw new OrbisError("Session did mismatch", {
        session: parsedSession,
        user,
      });
    }

    this.client.setDID(parsedSession.did);
    this.#user = user;

    this.#session = {
      authAttestation: session.authAttestation,
      authResource: session.authResource,
      session: parsedSession,
    };
  }

  async clearSession(): Promise<void> {
    this.#session = undefined;
    // @ts-ignore (force empty DID)
    this.client.setDID(undefined);
    this.#user = undefined;
  }

  async assertCurrentUser(user: AuthUserInformation): Promise<boolean> {
    if (!this.user) {
      return false;
    }

    return JSON.stringify(user) === JSON.stringify(this.user);
  }

  async getDocument(id: string): Promise<OrbisDocument> {
    const doc = await ModelInstanceDocument.load(this.client, id);

    return {
      id: doc.id.toString(),
      model: doc.metadata.model.toString(),
      content: doc.content as Record<string, any>,
      controller: doc.metadata.controller as DIDAny,
      metadata: {},
    };
  }

  async createDocument(params: NewOrbisDocument): Promise<{ id: string }> {
    if (!this.#session)
      throw new OrbisError(
        "[Ceramic] Unable to create document, no active Storage session."
      );

    const doc = await ModelInstanceDocument.create(
      this.client,
      params.content,
      {
        model: StreamID.fromString(params.model),
      }
    );

    return {
      id: doc.id.toString(),
    };
  }

  async updateDocument(
    id: string,
    params: NewOrbisDocument
  ): Promise<{ id: string }> {
    if (!this.#session)
      throw new OrbisError(
        "[Ceramic] Unable to update document, no active Storage session."
      );

    const doc = await ModelInstanceDocument.load(this.client, id);

    await doc.replace(params.content);

    return {
      id: doc.id.toString(),
    };
  }

  async getModel(id: string) {
    const model = await Model.load(this.client, id);

    return {
      id: model.id.toString(),
      schema: model.content,
      metadata: model.metadata,
    };
  }

  async createModel(modelDefinition: ModelDefinition): Promise<{ id: string }> {
    if (!this.#session)
      throw new OrbisError(
        "[Ceramic] Unable to create model, no active Storage session."
      );

    const model = await Model.create(this.client, modelDefinition, {
      controller: this.client.did?.id as string,
    });

    return {
      id: model.id.toString(),
    };
  }
}
