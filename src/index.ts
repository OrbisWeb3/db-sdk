/** Types */
import {
  AuthUserInformation,
  IAsyncStore,
  OrbisConfig,
  OrbisConnectParams,
  OrbisConnectResult,
  SupportedChains,
  IAuthenticatedCeramicResource,
} from "./types/index.js";

/** Utils */
import { OrbisNodeManager } from "./node/index.js";
import { Store } from "./util/store.js";
import { CeramicStorage } from "./ceramic/index.js";
import { OrbisError } from "./util/results.js";

import { catchError } from "./util/tryit.js";

import { LOCALSTORAGE_KEYS } from "./util/const.js";
import { DagJWS } from "dids";

import {
  QueryBuilder,
  SelectStatement,
  BulkInsertStatement,
  InsertStatement,
  UpdateByIdStatement,
} from "./querybuilder/index.js";

export class OrbisDB {
  #config: OrbisConfig;
  #store: IAsyncStore;

  readonly #nodes: OrbisNodeManager;
  readonly #ceramic: CeramicStorage;

  query: QueryBuilder;
  user?: AuthUserInformation;

  select: (...fields: Array<string | any>) => SelectStatement;
  insert: (model: string) => InsertStatement;
  insertBulk: (model: string) => BulkInsertStatement;
  update: (documentId: string) => UpdateByIdStatement;

  constructor(config: OrbisConfig) {
    this.#ceramic = new CeramicStorage(config.ceramic);
    this.#nodes = new OrbisNodeManager(config.nodes);
    this.#store = new Store(config.localStore);
    this.#config = config;

    this.query = new QueryBuilder(this);

    // Expose query builder methods top-level
    this.select = this.query.select.bind(this.query);
    this.insert = this.query.insert.bind(this.query);
    this.insertBulk = this.query.insertBulk.bind(this.query);
    this.update = this.query.update.bind(this.query);
  }

  get ceramic() {
    return this.#ceramic;
  }

  get nodes() {
    return this.#nodes.nodes;
  }

  get node() {
    return this.#nodes.active;
  }

  get session(): OrbisConnectResult | false {
    if (!this.user) {
      return false;
    }

    if (!this.ceramic.session) {
      return false;
    }

    return {
      user: this.user,
      session: this.ceramic.session,
      chain: this.user.chain,
    };
  }

  /**
   * Session
   */

  requireSession() {
    if (!this.session) {
      throw new OrbisError(
        "This method requires user authentication, no active user session found."
      );
    }
  }

  async #serializeActiveSession() {
    if (!this.session) {
      throw new OrbisError(
        "No active session found. (this.session is falsey)",
        {
          session: this.session,
        }
      );
    }

    return JSON.stringify(this.session);
  }

  async connectUser(params: OrbisConnectParams): Promise<OrbisConnectResult> {
    const { auth: authenticator, siwxOverwrites, saveSession = true } = params;
    const user = await authenticator.getUserInformation();

    const ceramicStorage = this.ceramic as IAuthenticatedCeramicResource;
    if (!(await ceramicStorage.assertCurrentUser(user))) {
      await ceramicStorage.authorize({ authenticator, siwxOverwrites });
    }

    this.user = user;

    if (!this.session) {
      throw new OrbisError(
        "No sessions created after authentication attempts.",
        { session: this.session }
      );
    }

    // User can set `saveSession` to false if they don't want the current session to be stored in local storage
    if (saveSession) {
      this.#store.setItem(
        LOCALSTORAGE_KEYS.session,
        await this.#serializeActiveSession()
      );
    }

    return this.session;
  }

  async disconnectUser(): Promise<void> {
    await this.ceramic.clearSession();

    this.user = undefined;

    this.#store.removeItem(LOCALSTORAGE_KEYS.session);
  }

  async isUserConnected(address?: string): Promise<boolean> {
    if (this.user) {
      if (address) {
        const userAddress = this.user.metadata.address;
        if (!userAddress) {
          return false;
        }

        if (this.user.chain === SupportedChains.evm) {
          return userAddress.toLowerCase() === address.toLowerCase();
        }

        return userAddress === address;
      }
      return true;
    }

    const session = await this.#store.getItem(LOCALSTORAGE_KEYS.session);
    if (!session) {
      return false;
    }

    const [parsed, err] = await catchError(() => JSON.parse(session));
    if (err) {
      this.#store.removeItem(LOCALSTORAGE_KEYS.session);
      console.warn("Error occured while parsing JSON", err);
      return false;
    }

    const user = (
      typeof parsed.user === "string" ? JSON.parse(parsed.user) : parsed.user
    ) as AuthUserInformation;

    if (!user) {
      this.#store.removeItem(LOCALSTORAGE_KEYS.session);
      console.warn("Unable to parse user information from a saved session.");
      return false;
    }

    const ceramicSession = parsed.session;
    if (ceramicSession) {
      const [_, err] = await catchError(() =>
        this.ceramic.setSession({
          user,
          session: ceramicSession,
        })
      );

      if (err) {
        this.#store.removeItem(LOCALSTORAGE_KEYS.session);
        console.warn("Error occured while parsing the session", err);
        return false;
      }
    }

    this.user = user;

    if (!this.session) {
      return false;
    }

    if (address) {
      const userAddress = this.user.metadata.address;
      if (!userAddress) {
        return false;
      }

      if (this.user.chain === SupportedChains.evm) {
        return userAddress.toLowerCase() === address.toLowerCase();
      }

      return userAddress === address;
    }

    this.#store.setItem(
      LOCALSTORAGE_KEYS.session,
      await this.#serializeActiveSession()
    );

    return true;
  }

  async getConnectedUser(): Promise<OrbisConnectResult | false> {
    if (!(await this.isUserConnected())) {
      return false;
    }

    if (this.session) {
      return this.session;
    }

    return false;
  }

  // Signing request
  async generateAuthHeaders() {
    if (!(await this.isUserConnected())) {
      throw new OrbisError(
        "Unable to generate authorization header, no active session found.",
        { session: this.session }
      );
    }

    const headers = {
      "x-orbis-auth-timestamp": String(Date.now()),
      "x-orbis-auth-did": (this.user as any).did,
    };

    const signature = await this.ceramic.did?.createJWS(headers);

    return {
      ...headers,
      "x-orbis-auth-signature": `${signature?.payload}.${signature?.signatures[0].protected}.${signature?.signatures[0].signature}`,
    };
  }

  /**
   * 
   * static async verifyCommitSignature(
    commitData: CommitData,
    did: DID,
    controller: string,
    model: StreamID | null,
    streamId: StreamID
  ): Promise<void> {
    try {
      const cacao = await this._verifyCapabilityAuthz(commitData, streamId, model)

      const atTime = commitData.timestamp ? new Date(commitData.timestamp * 1000) : undefined
      await did.verifyJWS(commitData.envelope, {
        atTime: atTime,
        issuer: controller,
        capability: cacao,
        revocationPhaseOutSecs: DEFAULT_CACAO_REVOCATION_PHASE_OUT,
        verifiers: verifiersCACAO,
      })
    } catch (e: any) {
      const original = e.message ? e.message : String(e)
      throw new Error(
        `Can not verify signature for commit ${commitData.cid} to stream ${streamId} which has controller DID ${controller}: ${original}`
      )
    }
  }
  *
  *
  * 
   */
  async verifyAuthHeaders(headers: any) {
    if (!(await this.isUserConnected())) {
      throw new OrbisError(
        "Unable to generate authorization header, no active session found.",
        { session: this.session }
      );
    }

    const splitSignature = headers["x-orbis-auth-signature"].split(".");
    const jws: DagJWS = {
      payload: splitSignature[0],
      signatures: [
        {
          protected: splitSignature[1],
          signature: splitSignature[2],
        },
      ],
    };

    return await this.ceramic.did?.verifyJWS(jws, {
      // issuer: headers["x-orbis-auth-did"],
    });
  }
}

export { createOrbisSiwxMessage } from "./siwx/index.js";
export * from "./types/index.js";
export { SupportedChains };
