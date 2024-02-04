import { StreamID } from "@ceramicnetwork/streamid";
import { DIDAny } from "./common.js";
import { IAuthenticatedResource } from "./resources.js";

export type OrbisDocument = {
  id: string;
  content: Record<string, any>;
  controller: DIDAny;
  model: string;
  context?: string;
  metadata: Record<string, any>;
};

export type NewOrbisDocument = {
  content: Record<string, any>;
  model: StreamID | string;
  context?: StreamID | string;
  metadata?: Record<string, any>;
};

export interface IOrbisStorage extends IAuthenticatedResource {
  getDocument(id: string): Promise<OrbisDocument>;
  createDocument(params: NewOrbisDocument): Promise<{ id: string }>;
  updateDocument(id: string, params: NewOrbisDocument): Promise<{ id: string }>;
}
