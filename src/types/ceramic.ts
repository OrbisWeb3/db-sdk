import { DIDAny } from "./common.js";
import { IAuthenticatedResource } from "./resources.js";

export type OrbisDocument = {
  id: string;
  content: Record<string, any>;
  controller: DIDAny;
  model: string;
  metadata: Record<string, any>;
};

export type NewOrbisDocument = {
  content: Record<string, any>;
  model: string;
  metadata?: Record<string, any>;
};

export interface IOrbisStorage extends IAuthenticatedResource {
  getDocument(id: string): Promise<OrbisDocument>;
  createDocument(
    params: Omit<OrbisDocument, "id" | "owner">
  ): Promise<{ id: string }>;
  updateDocument(
    id: string,
    params: Partial<Omit<OrbisDocument, "id" | "owner">>
  ): Promise<{ id: string }>;
}
