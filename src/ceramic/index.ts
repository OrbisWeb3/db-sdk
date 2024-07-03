import { CeramicClient } from "@ceramicnetwork/http-client";
import { ModelInstanceDocument } from "@ceramicnetwork/stream-model-instance";
import { Model, ModelDefinition } from "@ceramicnetwork/stream-model";

import {
  ICeramicStorage,
  CeramicDocument,
  NewCeramicDocument,
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
import { SupportedChains, DIDAny } from "../index.js";
import { OrbisError } from "../util/results.js";
import { AuthUserInformation, IKeyDidAuth, ISiwxAuth } from "../types/auth.js";
import { KeyDidSession, OrbisKeyDidAuth } from "../auth/keyDid.js";
import { StreamID } from "@ceramicnetwork/streamid";
import { parseSerializedSession } from "../util/session.js";

export class CeramicStorage implements ICeramicStorage {
  id = "ceramic";
  userFriendlyName = "Ceramic Network";
  supportedChains = [
    SupportedChains.evm,
    SupportedChains.solana,
    SupportedChains.tezos,
    SupportedChains.stacks,
  ];

  siwxResources = ["ceramic://*"];

  #session?: KeyDidSession | DIDSession;
  client: CeramicClient;

  constructor(params: CeramicConfig) {
    if ("client" in params) {
      this.client = params.client;
    } else {
      this.client = new CeramicClient(params.gateway);
    }
  }

  get did() {
    return this.client.did;
  }

  get session(): DIDSession | KeyDidSession | false {
    if (!this.#session) {
      return false;
    }

    return this.#session;
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
    authenticator: ISiwxAuth | IKeyDidAuth;
    siwxOverwrites?: Partial<SiwxMessage>;
  }): Promise<KeyDidSession | DIDSession> {
    const userInformation = await authenticator.getUserInformation();
    if (!this.supportedChains.includes(userInformation.chain)) {
      throw new OrbisError(
        "[Ceramic] Unsupported authentication method. Chain not supported " +
          userInformation.chain,
        { supportedChains: this.supportedChains }
      );
    }

    const { session, did } =
      "authenticateDid" in authenticator
        ? await this.#authenticateDid(authenticator)
        : await this.#authenticateSiwx(
            authenticator,
            userInformation,
            siwxOverwrites
          );

    this.client.setDID(did);
    this.#session = session;

    return this.#session;
  }

  async #authenticateDid(authenticator: IKeyDidAuth) {
    const { did, session } = await authenticator.authenticateDid();

    return {
      did,
      session,
    };
  }

  async #authenticateSiwx(
    authenticator: ISiwxAuth,
    userInformation: AuthUserInformation,
    siwxOverwrites?: Partial<SiwxMessage>
  ) {
    const keySeed = randomBytes(32);
    const didKey = await createDIDKey(keySeed);

    const session = await authenticator.authenticateSiwx({
      siwxOverwrites: {
        resources: this.siwxResources,
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

    const didSession = new DIDSession({
      keySeed,
      cacao,
      did: await createDIDCacao(didKey, cacao),
    });

    return {
      did: didSession.did,
      session: didSession,
    };
  }

  async setSession({
    session,
    did,
  }: {
    session: string;
    did?: DIDAny;
  }): Promise<KeyDidSession | DIDSession> {
    const parsedSession = await parseSerializedSession(session);

    if (parsedSession.sessionType === "key-did") {
      const keyDid = await OrbisKeyDidAuth.fromSession(parsedSession.session);

      if (did) {
        const keyUser = await keyDid.getUserInformation();
        if (did !== keyUser.did) {
          this.clearSession();
          throw new OrbisError("[Ceramic:setSession] DID mismatch", {
            parsedDid: keyUser.did,
            expectedDid: did,
          });
        }
      }

      const { session: resumedSession, did: parsedDid } =
        await keyDid.authenticateDid();

      this.client.setDID(parsedDid);
      this.#session = resumedSession;

      return this.#session;
    }

    const didSession = parsedSession.session as DIDSession;

    if (!didSession.hasSession) {
      this.clearSession();
      throw new OrbisError("[Ceramic] Invalid Ceramic session", {
        session: didSession,
        hasSession: didSession.hasSession,
      });
    }

    if (didSession.isExpired) {
      this.clearSession();
      throw new OrbisError("[Ceramic] Ceramic session expired", {
        session: didSession,
        isExpired: didSession.isExpired,
      });
    }

    if (did) {
      if (didSession.id !== did) {
        this.clearSession();
        throw new OrbisError("[Ceramic] Session did mismatch", {
          parsedDid: didSession.id,
          expectedDid: did,
        });
      }
    }

    this.client.setDID(didSession.did);
    this.#session = didSession;

    return this.#session;
  }

  async clearSession(): Promise<void> {
    this.#session = undefined;
    // @ts-ignore (force empty DID)
    this.client.setDID(undefined);
  }

  async assertCurrentUser(did: DIDAny): Promise<boolean> {
    if (!this.#session) {
      return false;
    }

    return this.client.did?.id === did;
  }

  async getDocument(id: string): Promise<CeramicDocument> {
    const doc = await ModelInstanceDocument.load(this.client, id);

    return {
      id: doc.id.toString(),
      model: doc.metadata.model.toString(),
      content: doc.content as Record<string, any>,
      controller: doc.metadata.controller as DIDAny,
      metadata: {},
    };
  }

  isStreamIdString(streamId: string): boolean {
    try {
      const _ = StreamID.fromString(streamId);
      return true;
    } catch (_) {
      return false;
    }
  }

  isStreamId(streamId: string | StreamID): boolean {
    if (streamId instanceof StreamID) {
      return true;
    }

    return this.isStreamIdString(streamId);
  }

  async createDocument(params: NewCeramicDocument): Promise<CeramicDocument> {
    if (!this.#session)
      throw new OrbisError(
        "[Ceramic] Unable to create document, no active Storage session."
      );

    const doc = await ModelInstanceDocument.create(
      this.client,
      params.content,
      {
        model:
          typeof params.model === "string"
            ? StreamID.fromString(params.model)
            : params.model,
        ...(params.context
          ? {
              context:
                typeof params.context === "string"
                  ? StreamID.fromString(params.context)
                  : params.context,
            }
          : {}),
      }
    );

    const { model, controller, ...metadata } = doc.metadata;

    return {
      id: doc.id.toString(),
      content: doc.content as Record<string, any>,
      model: model.toString(),
      context:
        doc.state.metadata.context?.toString() ||
        (params.context &&
          (typeof params.context === "string"
            ? params.context
            : params.context.toString())) ||
        undefined,
      controller: controller as DIDAny,
      metadata: metadata || {},
    };
  }

  async createDocumentSingle(
    params: NewCeramicDocument
  ): Promise<CeramicDocument> {
    if (!this.#session)
      throw new OrbisError(
        "[Ceramic] Unable to create document, no active Storage session."
      );

    const doc = await ModelInstanceDocument.single(this.client, {
      model:
        typeof params.model === "string"
          ? StreamID.fromString(params.model)
          : params.model,
      ...(params.context
        ? {
            context:
              typeof params.context === "string"
                ? StreamID.fromString(params.context)
                : params.context,
          }
        : {}),
    });

    await doc.replace(params.content);

    const { model, controller, ...metadata } = doc.metadata;

    return {
      id: doc.id.toString(),
      content: doc.content as Record<string, any>,
      model: model.toString(),
      context:
        doc.state.metadata.context?.toString() ||
        (params.context &&
          (typeof params.context === "string"
            ? params.context
            : params.context.toString())) ||
        undefined,
      controller: controller as DIDAny,
      metadata: metadata || {},
    };
  }

  async createDocumentSet(
    params: NewCeramicDocument,
    unique: Array<string>
  ): Promise<CeramicDocument> {
    if (!this.#session)
      throw new OrbisError(
        "[Ceramic] Unable to create document, no active Storage session."
      );

    const doc = await ModelInstanceDocument.set(
      this.client,
      {
        model:
          typeof params.model === "string"
            ? StreamID.fromString(params.model)
            : params.model,
        ...(params.context
          ? {
              context:
                typeof params.context === "string"
                  ? StreamID.fromString(params.context)
                  : params.context,
            }
          : {}),
      },
      unique
    );

    await doc.replace(params.content);

    const { model, controller, ...metadata } = doc.metadata;

    return {
      id: doc.id.toString(),
      content: doc.content as Record<string, any>,
      model: model.toString(),
      context:
        doc.state.metadata.context?.toString() ||
        (params.context &&
          (typeof params.context === "string"
            ? params.context
            : params.context.toString())) ||
        undefined,
      controller: controller as DIDAny,
      metadata: metadata || {},
    };
  }

  async updateDocument(
    id: string,
    content: Record<string, any>
  ): Promise<CeramicDocument> {
    if (!this.#session)
      throw new OrbisError(
        "[Ceramic] Unable to update document, no active Storage session."
      );

    const doc = await ModelInstanceDocument.load(this.client, id);

    await doc.replace(content);

    const { model, controller, ...metadata } = doc.metadata;

    return {
      id: doc.id.toString(),
      content: doc.content as Record<string, any>,
      model: model.toString(),
      context: doc.state.metadata.context?.toString(),
      controller: controller as DIDAny,
      metadata: metadata || {},
    };
  }

  async updateDocumentBySetter(
    id: string,
    setter: (document: ModelInstanceDocument) => Promise<Record<string, any>>
  ): Promise<CeramicDocument> {
    if (!this.#session)
      throw new OrbisError(
        "[Ceramic] Unable to update document, no active Storage session."
      );

    const doc = (await ModelInstanceDocument.load(
      this.client,
      id
    )) as ModelInstanceDocument<Record<string, any>>;

    await doc.replace(await setter(doc));

    const { model, controller, ...metadata } = doc.metadata;

    return {
      id: doc.id.toString(),
      content: doc.content as Record<string, any>,
      model: model.toString(),
      context: doc.state.metadata.context?.toString(),
      controller: controller as DIDAny,
      metadata: metadata || {},
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
