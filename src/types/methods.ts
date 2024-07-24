import { SiwxMessage } from "@didtools/cacao";
import {
  AuthUserInformation,
  IDidAuth,
  ISiwxAuth,
  OrbisAuthSession,
} from "./auth.js";

import { SupportedChains } from "./providers.js";

export type OrbisConnectParams = (
  | {
      auth: ISiwxAuth | IDidAuth;
      siwxOverwrites?: Partial<SiwxMessage>;
    }
  | { serializedSession: string }
) & {
  saveSession?: boolean;
};

export type OrbisConnectResult = {
  auth: OrbisAuthSession;
  user: AuthUserInformation;
  chain: SupportedChains;
};

export type OrbisPagination = {
  page?: number;
  limit?: number;
};
