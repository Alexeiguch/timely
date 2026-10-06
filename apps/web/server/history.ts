import { historyRepository, HistoryExpired } from "@timely/db/history";
import { ApiError } from "./api";
export async function historyPage(ownerId: string, input: unknown) {
  try { return await historyRepository().page(ownerId, input); }
  catch (error) {
    if (error instanceof HistoryExpired) throw new ApiError("CURSOR_EXPIRED", 409, error.message);
    throw error;
  }
}
