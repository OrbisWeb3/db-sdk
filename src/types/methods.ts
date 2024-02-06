import { SiwxMessage } from "@didtools/cacao";
import {
  AuthUserInformation,
  IKeyDidAuth,
  IOrbisAuth,
  SerializedOrbisSession,
} from "./auth.js";

import { SupportedChains } from "./providers.js";

export type OrbisConnectParams = {
  auth: IOrbisAuth | IKeyDidAuth;
  siwxOverwrites?: Partial<SiwxMessage>;
  saveSession?: boolean;
};

export type OrbisConnectResult = {
  session: SerializedOrbisSession;
  user: AuthUserInformation;
  chain: SupportedChains;
};

export type OrbisPagination = {
  page?: number;
  limit?: number;
};
