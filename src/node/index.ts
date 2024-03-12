import { MethodStatuses } from "../types/results.js";
import { ForceIndexingResult, OrbisConfig } from "../index.js";

type ModelMapping = {
  [modelId: string]: string;
};

type NodeInformation = {
  version: string;
  models: Array<{ name: string; stream_id: string }>;
  models_mapping: ModelMapping;
  plugins: Array<{ id: string; name: string; hooks: Array<string> }>;
};

type NodeContext = {
  gateway: string;
  key?: string;
  isPrimary: boolean;
  metadata?: NodeInformation;
};

function buildUrl(node: NodeContext, route: string) {
  const _route = route.startsWith("/") ? route : "/" + route;
  return node.gateway + _route;
}

async function apiFetch(node: NodeContext, route: string, opts?: RequestInit) {
  if (node.key) {
    if (opts) {
      opts.headers = {
        ...(opts.headers || {}),
        "x-orbis-api-key": node.key,
      };
    }
  }

  const url = buildUrl(node, route);

  return fetch(url, opts);
}

async function ping(node: NodeContext): Promise<boolean> {
  const response = await apiFetch(node, "/api/ping");
  const text = await response.text();

  if (text === "pong") {
    return true;
  }

  return false;
}

async function fetchMetadata(node: NodeContext): Promise<NodeInformation> {
  const response = await apiFetch(node, "/api/metadata");
  return (await response.json()) as NodeInformation;
}

export async function queryDatabase<T = Record<string, any>>(
  node: NodeContext,
  jsonQuery: Record<string, any>
): Promise<{ columns: Array<string>; rows: Array<T> }> {
  const response = await apiFetch(node, "/api/db/query/json", {
    method: "POST",
    headers: {
      "Content-type": "application/json",
    },
    body: JSON.stringify({ jsonQuery }),
  });

  const { status, data = [] } = await response.json();
  if (![200, 404].includes(Number(status))) {
    throw `Error querying database. Status code: ${status || response.status || "Unknown"} (${response.statusText || response.status || ""})`;
  }

  return {
    columns: data.length ? Object.keys(data[0]) : [],
    rows: data,
  };
}

async function index(
  node: NodeContext,
  id: string
): Promise<ForceIndexingResult> {
  try {
    const result = await apiFetch(node, `/force-index/${id}`);
    const serverResponse = await result.json();

    const {
      status,
      error: indexingError,
      result: indexingResult,
    } = serverResponse;

    if (status === 200) {
      return {
        status: MethodStatuses.ok,
        result: indexingResult,
        serverResponse,
      };
    }

    return {
      status: MethodStatuses.genericError,
      error: indexingError || indexingResult || status,
      serverResponse,
    };
  } catch (e: any) {
    return {
      status: MethodStatuses.genericError,
      serverResponse: null,
      error: e.message,
    };
  }
}

export class OrbisNode {
  node: NodeContext;

  constructor(node: NodeContext) {
    this.node = node;
  }

  async query<T = Record<string, any>>(
    jsonQuery: Record<string, any>
  ): Promise<{
    columns: Array<string>;
    rows: Array<T>;
  }> {
    return queryDatabase(this.node, jsonQuery);
  }

  async fetch(route: string, opts?: RequestInit) {
    return apiFetch(this.node, route, opts);
  }

  async ping() {
    return {
      pong: await ping(this.node),
      node: this.node,
    };
  }

  async metadata(forceRefresh: boolean = false) {
    if (this.node.metadata && !forceRefresh) {
      const { metadata, ...node } = this.node;
      return {
        metadata,
        node,
      };
    }

    try {
      const result = await fetchMetadata(this.node);
      this.node.metadata = result;

      const { metadata, ...node } = this.node;

      return {
        metadata,
        node,
      };
    } catch (e) {
      console.log("Couldn't retrieve metadata for this OrbisDB instance.");
      return {
        metadata: null,
        node: this.node,
      };
    }
  }

  async models() {
    const { metadata, ...node } = await this.metadata();

    return {
      models: metadata?.models,
      node,
    };
  }

  async plugins() {
    const { metadata, ...node } = await this.metadata();
    return {
      plugins: metadata?.plugins,
      node,
    };
  }

  // Add a method to get the human-readable table name for a model ID
  async getTableName(id: string) {
    const { metadata, ...node } = await this.metadata();

    return {
      tableName: metadata?.models_mapping[id],
      node,
    };
  }

  // Add a method to get the model ID for a human-readable table name
  async getTableModelId(tableName: string) {
    const { metadata, ...node } = this.node;

    const modelsMapping = metadata?.models_mapping;
    const modelId = Object.keys(modelsMapping || {}).find((key: string) => {
      return modelsMapping && tableName === modelsMapping[key];
    });

    return {
      modelId,
      node,
    };
  }
}

export class OrbisNodeManager {
  #nodes: Array<OrbisNode>;
  #currentNode: OrbisNode;

  constructor(nodes: OrbisConfig["nodes"]) {
    if (!nodes.length) {
      throw "[OrbisNodeManager] You must provide at least one (1) OrbisNode configuration.";
    }

    this.#nodes = nodes.map(
      ({ gateway, key }, index) =>
        new OrbisNode({
          gateway: gateway.replace(/\/$/, ""),
          key,
          isPrimary: index === 0,
        })
    );

    this.#currentNode = this.#nodes[0];
  }

  get nodes() {
    return this.#nodes;
  }

  get active() {
    return this.#currentNode;
  }
}
