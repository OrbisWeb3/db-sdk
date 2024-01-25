import type {
  SiwTezosMessage,
  SiweMessage,
  SiwsMessage,
  SiwxMessage,
} from "@didtools/cacao";

export type SiwxMessageToSign =
  | SiwxMessage
  | SiweMessage
  | SiwsMessage
  | SiwTezosMessage;

export type SignedSiwxMessage = SiwxMessage & { signature: string };
