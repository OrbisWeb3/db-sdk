import { OrbisConfig } from "../index.js";
import { OrbisError } from "../util/results.js";

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
  isPrimary: boolean;
  env?: string;
  key?: string;
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
  jsonQuery: Record<string, any>,
  env?: string
): Promise<{ columns: Array<string>; rows: Array<T> }> {
  const environment = env || node.env;

  const response = await apiFetch(node, "/api/db/query/json", {
    method: "POST",
    headers: {
      "Content-type": "application/json",
    },
    body: JSON.stringify({ jsonQuery, env: environment }),
  });

  if (![200, 404].includes(response.status)) {
    throw new OrbisError(
      `Error querying database. Status code: ${response.status || "Unknown"} (${response.statusText || response.status || ""})`,
      { node, query: jsonQuery, environment }
    );
  }

  const { data = [] } = await response.json();

  return {
    columns: data.length ? Object.keys(data[0]) : [],
    rows: data,
  };
}

export class OrbisNode {
  node: NodeContext;

  constructor(node: NodeContext) {
    this.node = node;
  }

  get env() {
    return this.node.env;
  }

  async query<T = Record<string, any>>(
    jsonQuery: Record<string, any>,
    env?: string
  ): Promise<{
    columns: Array<string>;
    rows: Array<T>;
  }> {
    return queryDatabase(this.node, jsonQuery, env);
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
      ({ gateway, key, env }, index) =>
        new OrbisNode({
          gateway: gateway.replace(/\/$/, ""),
          isPrimary: index === 0,
          key,
          env,
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
