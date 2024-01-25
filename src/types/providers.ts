export enum SupportedChains {
  ethereum = "ethereum",
  evm = "ethereum",
  solana = "solana",
  stacks = "stacks",
  tezos = "tezos",
}

export interface IGenericSignerProvider {
  readonly genericSignerId: string;
  chain: SupportedChains;
  connect(): Promise<void>;
  getAddress(): Promise<string>;
  signMessage(message: string): Promise<string>;
}

export interface IEVMProvider {
  enable?: () => Promise<void>;
  request({
    method,
    params,
  }: {
    method: string;
    params?: unknown[] | object;
  }): Promise<any>;
  signMessage?: (message: string) => Promise<string | { signature: string }>;
  getAddress?: () => Promise<string | Array<string>>;
}

export interface ISolProvider {
  isConnected?: boolean;
  connected?: boolean;
  connect(): Promise<void>;
  publicKey: string | { toString(): string };
  signMessage(
    message: Uint8Array
  ): Promise<Uint8Array> | Promise<{ signature: Uint8Array }>;
}

export interface ITezosProvider {
  getActiveAccount(): Promise<{ publicKey: string; address: string }>;
  requestSignPayload({
    signingType,
    payload,
  }: {
    signingType: "micheline";
    payload: string;
  }): Promise<string | { signature: string }>;
  requestPermissions?: ({
    network,
  }: {
    network: { type: "mainnet" | "ghostnet" };
  }) => Promise<void>;
  checkPermissions?: (scope: string) => Promise<boolean>;
}

export type SupportedProvider =
  | IEVMProvider
  | ISolProvider
  | ITezosProvider
  | IGenericSignerProvider;
