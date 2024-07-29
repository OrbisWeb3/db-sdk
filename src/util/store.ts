import { IAsyncStore, IStore, StoreConfig } from "../types/util.js";

export class MemoryStore implements IStore {
  message: string =
    "[MemoryStore] An in-memory store is being used. Data will not be preserved between sessions.";
  memoryStore: { [key: string]: any } = {};

  getItem(key: string) {
    return this.memoryStore[key];
  }

  setItem(key: string, value: any): boolean {
    this.memoryStore[key] = value;
    return false;
  }

  removeItem(key: string): boolean {
    delete this.memoryStore[key];
    return false;
  }
}

/** Store class to use localStorage or AsyncStorage */
export class Store implements IAsyncStore {
  /** Type of storage we want to use: 'localStorage' or 'AsyncStorage' */
  #storage: IStore | IAsyncStore;

  /** Initialize storage with one of the supported options */
  constructor(options?: StoreConfig) {
    if (options && options.storage) {
      this.#storage = options.storage;
    } else {
      if (typeof localStorage === "undefined") {
        this.#storage = new MemoryStore();
      } else {
        this.#storage = localStorage as unknown as IStore;
      }
    }
  }

  async setItem(key: string, value: string) {
    await this.#storage.setItem(key, value);
    return true;
  }

  async getItem(key: string) {
    return await this.#storage.getItem(key);
  }

  async removeItem(key: string) {
    await this.#storage.removeItem(key);
    return true;
  }
}
