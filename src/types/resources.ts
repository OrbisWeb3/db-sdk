import { SupportedChains } from "./providers.js";
import {
  IOrbisAuth,
  AuthUserInformation,
  IKeyDidAuth,
  SerializedOrbisSession,
} from "./auth.js";
import { SiwxMessage } from "@didtools/cacao";

export enum OrbisResources {
  storage = "storage",
}

export interface IAuthenticatedResource {
  id: string;
  userFriendlyName: string;
  supportedChains: Array<SupportedChains>;

  user?: AuthUserInformation;
  session: SerializedOrbisSession | false;

  connect(params?: any): Promise<void>;
  authorize({
    authenticator,
    siwxOverwrites,
  }: {
    authenticator: IOrbisAuth;
    siwxOverwrites?: Partial<SiwxMessage>;
  }): Promise<any>;

  setSession({
    user,
    session,
  }: {
    user: AuthUserInformation;
    session: any;
  }): Promise<void>;
  clearSession(): Promise<void>;
  assertCurrentUser(user: AuthUserInformation): Promise<boolean>;
}

export interface IAuthenticatedCeramicResource extends IAuthenticatedResource {
  authorize({
    authenticator,
    siwxOverwrites,
  }: {
    authenticator: IOrbisAuth | IKeyDidAuth;
    siwxOverwrites?: Partial<SiwxMessage>;
  }): Promise<any>;
}
