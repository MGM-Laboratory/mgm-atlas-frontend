export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { message?: string | string[]; error?: string } & Record<string, unknown>,
  ) {
    const msg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message ?? body.error ?? `Request failed with status ${status}`;
    super(msg);
    this.name = 'ApiError';
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
