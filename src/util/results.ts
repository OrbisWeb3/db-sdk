import { MethodStatuses } from "../types/results.js";

export class OrbisError<T = any> extends Error {
  status: number;
  details?: any;

  constructor(
    message: string = "",
    details?: T,
    status: MethodStatuses = MethodStatuses.genericError
  ) {
    super(message);

    this.status = status;
    this.details = details;
  }

  toString() {
    return JSON.stringify({
      status: this.status,
      message: this.message,
      details: this.details,
    });
  }
}
