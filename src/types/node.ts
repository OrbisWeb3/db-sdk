import { MethodStatuses } from "./results.js";

export type ForceIndexingResult =
  | {
      status: MethodStatuses.ok;
      result: string;
      serverResponse: Record<string, any>;
    }
  | {
      status: MethodStatuses.genericError;
      error: string;
      serverResponse: null | Record<string, any>;
    };
