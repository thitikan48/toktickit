/**
 * Writes the real cause of an unexpected error to the server terminal.
 * The client only ever receives a safe, generic message.
 */
export function logServerError(error: unknown) {
  console.error("[TokTickIT API] Unexpected error:", error);
}
