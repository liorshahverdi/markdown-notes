import { APIError } from './apiClient.js';

export interface JsonErrorOutput {
  ok: false;
  error: {
    message: string;
    code: string;
    status?: number;
    statusText?: string;
    body?: unknown;
  };
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function printHuman(value: string): void {
  console.log(value);
}

export function formatErrorForJson(error: unknown): JsonErrorOutput {
  if (error instanceof APIError) {
    return {
      ok: false,
      error: {
        message: error.message,
        code: 'API_ERROR',
        status: error.status,
        statusText: error.statusText,
        body: error.body,
      },
    };
  }

  return {
    ok: false,
    error: {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'ERROR',
    },
  };
}

export function printError(error: unknown, json = false): never {
  if (json) {
    console.error(JSON.stringify(formatErrorForJson(error), null, 2));
  } else {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error: ${message}`);
  }
  process.exit(1);
}
