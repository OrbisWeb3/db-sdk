import {
  IGenericSignerProvider,
  IEVMProvider,
  SupportedChains,
} from "../types/index.js";
import { keccak_256 } from "@noble/hashes/sha3";

function uint8ToHex(uint8: Uint8Array) {
  return Array.from(uint8)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

class OrbisEVMProvider implements IGenericSignerProvider {
  readonly genericSignerId = "orbis-evm";
  readonly chain = SupportedChains.evm;
  #provider: IEVMProvider;

  constructor(provider: IEVMProvider) {
    this.#provider = provider;
  }

  async connect(): Promise<void> {
    if (typeof this.#provider.enable === "function") {
      await this.#provider.enable();
      return;
    }

    if (typeof this.#provider.request === "function") {
      await this.#provider.request({
        method: "eth_requestAccounts",
        params: [],
      });
    }
  }

  #checksumAddress(_address: string): string {
    const address = _address.replace(/^0x/i, "").toLowerCase();
    const hash = keccak_256(address);
    const hex = uint8ToHex(hash);
    if (
      !hex ||
      hex ===
        "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
    )
      return _address;

    let checksumAddress = "0x";
    for (let i = 0; i < address.length; i += 1) {
      if (parseInt(hex[i], 16) > 7) {
        checksumAddress += address[i].toUpperCase();
      } else {
        checksumAddress += address[i];
      }
    }

    return checksumAddress;
  }

  async getAddress(): Promise<string> {
    if (typeof this.#provider.getAddress === "function") {
      const address = await this.#provider.getAddress();
      if (typeof address === "string") {
        return this.#checksumAddress(address);
      }

      if (!address || !address.length) {
        throw "No eth accounts found";
      }

      return this.#checksumAddress(address[0]);
    }

    const accounts: string[] = await this.#provider.request({
      method: "eth_accounts",
    });

    if (!accounts.length) {
      throw "No eth accounts found";
    }

    return this.#checksumAddress(accounts[0]);
  }

  async signMessage(message: string): Promise<string> {
    if (typeof this.#provider.signMessage === "function") {
      const signature = await this.#provider.signMessage(message);
      if (typeof signature === "string") {
        return signature;
      }
      return signature.signature;
    }

    const signature: string = await this.#provider.request({
      method: "personal_sign",
      params: [message, await this.getAddress()],
    });

    return signature;
  }
}

export function normalizeEVMProvider({
  provider,
}: {
  provider: IEVMProvider;
}): IGenericSignerProvider {
  return new OrbisEVMProvider(provider);
}
