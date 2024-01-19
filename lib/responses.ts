export interface ErrorResponse {
  apiVersion: '1';
  error: {code: number; message: string;};
}

export function createErrorResponse(
    code: number, message: string): ErrorResponse {
  return {
    apiVersion: '1',
    error: {code, message},
  };
}
