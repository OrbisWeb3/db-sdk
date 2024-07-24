/** Types */
import {
  AuthUserInformation,
  IAsyncStore,
  OrbisConfig,
  OrbisConnectParams,
  OrbisConnectResult,
  SupportedChains,
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
import { buildOrbisSession, parseSerializedSession } from "./util/session.js";

export class OrbisDB {
  #config: OrbisConfig;
  #store: IAsyncStore;

  readonly #nodes: OrbisNodeManager;
  readonly #ceramic: CeramicStorage;

  query: QueryBuilder;

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

  get did() {
    return this.ceramic.did;
  }

  get nodes() {
    return this.#nodes.nodes;
  }

  get node() {
    return this.#nodes.active;
  }

  get session(): OrbisConnectResult | false {
    if (!this.ceramic.session) {
      return false;
    }

    return buildOrbisSession(this.ceramic.session);
  }

  get serializedSession(): string | false {
    if (!this.session) {
      return false;
    }

    return this.session.auth.serializedSession;
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

  async connectUser(params: OrbisConnectParams): Promise<OrbisConnectResult> {
    if ("serializedSession" in params) {
      await this.ceramic.setSession({ session: params.serializedSession });
    } else {
      const { auth: authenticator, siwxOverwrites } = params;

      const user = await authenticator.getUserInformation();

      if (!(await this.ceramic.assertCurrentUser(user.did))) {
        await this.ceramic.authorize({ authenticator, siwxOverwrites });
      }
    }

    if (!this.session) {
      throw new OrbisError(
        "No sessions created after authentication attempts.",
        { session: this.session }
      );
    }

    if (params.saveSession !== false) {
      this.#store.setItem(LOCALSTORAGE_KEYS.session, this.serializedSession);
    }

    return this.session;
  }

  async disconnectUser(): Promise<void> {
    await this.ceramic.clearSession();
    this.#store.removeItem(LOCALSTORAGE_KEYS.session);
  }

  async isUserConnected(address?: string): Promise<boolean> {
    if (this.session) {
      const user = this.session.user;
      if (address) {
        const userAddress = user.metadata.address || user.metadata.publicKey;
        if (!userAddress) {
          return false;
        }

        if (user.chain === SupportedChains.evm) {
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

    const [parsed, parseErr] = await catchError(() =>
      parseSerializedSession(session)
    );
    if (parseErr) {
      this.#store.removeItem(LOCALSTORAGE_KEYS.session);
      console.warn("Error occured while parsing JSON", parseErr);
      return false;
    }

    const [_, ceramicErr] = await catchError(() =>
      this.ceramic.setSession({ session: parsed.serialized })
    );
    if (ceramicErr) {
      this.#store.removeItem(LOCALSTORAGE_KEYS.session);
      console.warn("Error occured while parsing the session", ceramicErr);
      return false;
    }

    if (!this.session) {
      return false;
    }

    if (address) {
      const user = (this.session as OrbisConnectResult).user;
      const userAddress = user.metadata.address || user.metadata.publicKey;
      if (!userAddress) {
        return false;
      }

      if (user.chain === SupportedChains.evm) {
        return userAddress.toLowerCase() === address.toLowerCase();
      }

      return userAddress === address;
    }

    this.#store.setItem(LOCALSTORAGE_KEYS.session, this.serializedSession);

    return true;
  }

  async getConnectedUser(): Promise<OrbisConnectResult | false> {
    if (!(await this.isUserConnected())) {
      return false;
    }

    return this.session;
  }

  // // Signing request
  // async generateAuthHeaders() {
  //   if (!(await this.isUserConnected())) {
  //     throw new OrbisError(
  //       "Unable to generate authorization header, no active session found.",
  //       { session: this.session }
  //     );
  //   }

  //   const headers = {
  //     "x-orbis-auth-timestamp": String(Date.now()),
  //     "x-orbis-auth-did": (this.user as any).did,
  //   };

  //   const signature = await this.ceramic.did?.createJWS(headers);

  //   return {
  //     ...headers,
  //     "x-orbis-auth-signature": `${signature?.payload}.${signature?.signatures[0].protected}.${signature?.signatures[0].signature}`,
  //   };
  // }

  // /**
  //  *
  //  * static async verifyCommitSignature(
  //   commitData: CommitData,
  //   did: DID,
  //   controller: string,
  //   model: StreamID | null,
  //   streamId: StreamID
  // ): Promise<void> {
  //   try {
  //     const cacao = await this._verifyCapabilityAuthz(commitData, streamId, model)

  //     const atTime = commitData.timestamp ? new Date(commitData.timestamp * 1000) : undefined
  //     await did.verifyJWS(commitData.envelope, {
  //       atTime: atTime,
  //       issuer: controller,
  //       capability: cacao,
  //       revocationPhaseOutSecs: DEFAULT_CACAO_REVOCATION_PHASE_OUT,
  //       verifiers: verifiersCACAO,
  //     })
  //   } catch (e: any) {
  //     const original = e.message ? e.message : String(e)
  //     throw new Error(
  //       `Can not verify signature for commit ${commitData.cid} to stream ${streamId} which has controller DID ${controller}: ${original}`
  //     )
  //   }
  // }
  // *
  // *
  // *
  //  */
  // async verifyAuthHeaders(headers: any) {
  //   if (!(await this.isUserConnected())) {
  //     throw new OrbisError(
  //       "Unable to generate authorization header, no active session found.",
  //       { session: this.session }
  //     );
  //   }

  //   const splitSignature = headers["x-orbis-auth-signature"].split(".");
  //   const jws: DagJWS = {
  //     payload: splitSignature[0],
  //     signatures: [
  //       {
  //         protected: splitSignature[1],
  //         signature: splitSignature[2],
  //       },
  //     ],
  //   };

  //   return await this.ceramic.did?.verifyJWS(jws, {
  //     // issuer: headers["x-orbis-auth-did"],
  //   });
  // }
}

export { createOrbisSiwxMessage } from "./siwx/index.js";
export * from "./types/index.js";
export { SupportedChains };
