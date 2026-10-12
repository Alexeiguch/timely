import { t, errorMessage } from "@timely/i18n";
import { useLanguage } from "./language-state";
import { reduceRecord } from "@timely/sync";
import type { TaskRecord } from "@timely/contracts";
type Props = {
  records: TaskRecord[];
  historyFrom: string;
  historyThrough: string;
  historyState: string;
  historyPriority: string;
  historyDefinition?: string;
  historyError: string;
  historyBusy: boolean;
  onlineSnapshot: boolean;
  hasMore: boolean;
  setHistoryFrom: (value: string) => void;
  setHistoryThrough: (value: string) => void;
  setHistoryState: (value: string) => void;
  setHistoryPriority: (value: string) => void;
  setHistoryDefinition: (value: string | undefined) => void;
  load: () => Promise<void>;
  showDownloaded: () => void;
};
export function PlannerHistoryFilters({
  records,
  historyFrom,
  historyThrough,
  historyState,
  historyPriority,
  historyDefinition,
  historyError,
  historyBusy,
  onlineSnapshot,
  hasMore,
  setHistoryFrom,
  setHistoryThrough,
  setHistoryState,
  setHistoryPriority,
  setHistoryDefinition,
  load,
  showDownloaded,
}: Props) {
  useLanguage();
  return (
    <section className="history-filters settings-card">
      <div className="form-grid">
        <label>
          {t("From date")}
          <input
            type="date"
            value={historyFrom}
            min="1900-01-01"
            max="2100-12-31"
            onChange={(event) => setHistoryFrom(event.target.value)}
          />
        </label>
        <label>
          {t("Through date")}
          <input
            type="date"
            value={historyThrough}
            min="1900-01-01"
            max="2100-12-31"
            onChange={(event) => setHistoryThrough(event.target.value)}
          />
        </label>
        <label>
          {t("Task status")}
          <select
            aria-label={t("Task status")}
            value={historyState}
            onChange={(event) => setHistoryState(event.target.value)}
          >
            {["all", "overdue", "pending", "completed", "skipped"].map(
              (value) => (
                <option key={value} value={value}>
                  {t(value)}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          {t("Priority filter")}
          <select
            aria-label={t("Priority filter")}
            value={historyPriority}
            onChange={(event) => setHistoryPriority(event.target.value)}
          >
            {["all", "none", "low", "medium", "high"].map((value) => (
              <option key={value} value={value}>
                {t(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Series filter")}
          <select
            aria-label={t("Series filter")}
            value={historyDefinition ?? "all"}
            onChange={(event) =>
              setHistoryDefinition(
                event.target.value === "all" ? undefined : event.target.value,
              )
            }
          >
            <option value="all">{t("All plans")}</option>
            {records
              .filter((record) =>
                reduceRecord(record).revisions.some(
                  (revision) => revision.task.rule,
                ),
              )
              .map((record) => (
                <option key={record.id} value={record.id}>
                  {reduceRecord(record).revisions.at(-1)!.task.title}
                </option>
              ))}
          </select>
        </label>
      </div>
      {historyError && <p role="alert">{errorMessage(historyError)}</p>}
      <p className="muted">
        {onlineSnapshot
          ? t("Online snapshot for this range")
          : t(
              "Downloaded plans are available offline. Load online history to check a fixed server snapshot.",
            )}
      </p>
      <button
        disabled={historyBusy || !!historyError || (onlineSnapshot && !hasMore)}
        onClick={() => {
          void load();
        }}
      >
        {historyBusy
          ? t("Loading\u2026")
          : hasMore
            ? t("Load more history")
            : t("Load online history")}
      </button>
      {onlineSnapshot && (
        <button
          onClick={() => {
            showDownloaded();
          }}
        >
          {t("Return to downloaded plans")}
        </button>
      )}
    </section>
  );
}
