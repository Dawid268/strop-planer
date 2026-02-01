/**
 * Generyczny interfejs odpowiedzi API zgodny ze standardem Enterprise (§ 1.3).
 */
export interface ApiResponse<T> {
  readonly data: T;
  readonly status: "success" | "error";
  readonly message: string;
  readonly timestamp: string;
  readonly meta?: Record<string, any>;
}
