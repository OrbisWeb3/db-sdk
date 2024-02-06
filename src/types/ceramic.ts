import { StreamID } from "@ceramicnetwork/streamid";
import { DIDAny } from "./common.js";
import { IAuthenticatedResource } from "./resources.js";
import { ModelInstanceDocument } from "@ceramicnetwork/stream-model-instance";

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
  updateDocument(
    id: string,
    params: Record<string, any>
  ): Promise<{ id: string }>;
  updateDocumentBySetter(
    id: string,
    setter: (document: ModelInstanceDocument) => Promise<Record<string, any>>
  ): Promise<OrbisDocument>;
}
