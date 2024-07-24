import { SupportedChains } from "../index.js";
import { AuthUserInformation, IDidAuth } from "../types/auth.js";
import { DID } from "dids";
import { DIDAny } from "../types/common.js";
import { createDIDKey } from "did-session";
import {
  encodeBase64,
  uint8ArraytoHex,
  hexToUint8Array,
} from "../util/conversion.js";
import { parseSerializedSession } from "../util/session.js";

// Think about unifying with DIDSession from Ceramic
export class KeyDidSession {
  #seed: string;
  #did: DIDAny;

  constructor(seed: Uint8Array | string, did: DIDAny) {
    this.#seed = typeof seed === "string" ? seed : uint8ArraytoHex(seed);
    this.#did = did;
  }

  get seed() {
    return this.#seed;
  }

  get did() {
    return this.#did;
  }

  static async fromSession(session: string): Promise<KeyDidSession> {
    const sess = await parseSerializedSession(session);
    if (sess.sessionType === "key-did") {
      return sess.session;
    }

    throw `[KeyDidSession] Incorrect session type ${sess.sessionType}`;
  }

  serialize() {
    return encodeBase64(
      JSON.stringify({
        sessionType: "key-did",
        did: this.#did,
        seed: this.#seed,
      })
    );
  }
}

export class OrbisKeyDidAuth implements IDidAuth {
  orbisAuthId: "ceramic-did" = "ceramic-did";
  chain = SupportedChains.evm;

  #did: DID;
  #seed: Uint8Array;

  constructor(did: DID, seed: Uint8Array) {
    this.#seed = seed;
    this.#did = did;
  }

  static async generateSeed(format: "hex" | "uint8" = "uint8") {
    const buffer = new Uint8Array(32);
    const seed = crypto.getRandomValues(buffer);

    if (format === "uint8") {
      return seed;
    }
    return uint8ArraytoHex(seed);
  }

  static async createRandom(): Promise<IDidAuth> {
    const seed = await this.generateSeed();

    return this.fromSeed(seed);
  }

  static async fromSession(session: string | KeyDidSession) {
    const keySession =
      typeof session === "string"
        ? await KeyDidSession.fromSession(session)
        : session;

    return this.fromSeed(keySession.seed);
  }

  static async fromSeed(seed: string | Uint8Array): Promise<IDidAuth> {
    const parsedSeed = typeof seed === "string" ? hexToUint8Array(seed) : seed;
    const did = await createDIDKey(parsedSeed);

    return new OrbisKeyDidAuth(did, parsedSeed);
  }

  async getUserInformation(): Promise<AuthUserInformation> {
    return {
      did: this.#did.id as DIDAny,
      chain: this.chain,
      metadata: {
        publicKey: this.#did.id.split(":").pop(),
      },
    };
  }

  async authenticateDid(): Promise<{ did: DID; session: KeyDidSession }> {
    return {
      did: this.#did,
      session: new KeyDidSession(this.#seed, this.#did.id as DIDAny),
    };
  }
}
