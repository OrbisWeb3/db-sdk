export interface IStore {
  setItem(key: string, value: any): boolean;
  getItem(key: string): any;
  removeItem(key: string): boolean;
}

export interface IAsyncStore {
  setItem(key: string, value: any): Promise<boolean> | boolean;
  getItem(key: string): Promise<any> | any;
  removeItem(key: string): Promise<boolean> | boolean;
}

export type StoreConfig = {
  storage?: IStore | IAsyncStore;
};
