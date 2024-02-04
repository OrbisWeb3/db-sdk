export class StatementHistory {
  #runs: Array<
    { success: boolean; timestamp: number; query: any; [k: string]: any } & (
      | { result: any }
      | { error: any }
    )
  > = [];

  constructor() {}

  get runs() {
    return this.#runs;
  }

  storeResult(
    run: {
      success: boolean;
      timestamp: number;
      query: any;
      [k: string]: any;
    } & ({ result: any } | { error: any })
  ) {
    this.#runs.push(run);
  }

  clearHistory() {
    this.#runs = [];
  }
}
