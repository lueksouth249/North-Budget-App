import {
  AlertTriangle,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import {
  useState
} from "react";
import { useNavigate } from "react-router-dom";
import { SplitEditor } from "../components/SplitEditor";
import { StatusMessage } from "../components/StatusMessage";
import {
  makeTransaction,
  useAppData
} from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { useImportSession } from "../context/ImportContext";
import { transactionIsValidSplit } from "../lib/budget";
import { formatCurrency } from "../lib/currency";
import type {
  ParsedTransaction,
  TransactionAllocation
} from "../types/models";

export function ImportReviewPage() {
  const {
    transactions,
    summary,
    updateTransactions,
    clear
  } = useImportSession();

  const {
    buckets,
    saveManyTransactions
  } = useAppData();

  const { user } = useAuth();
  const navigate = useNavigate();

  const [
    saving,
    setSaving
  ] = useState(false);

  const [
    error,
    setError
  ] = useState<string | null>(null);

  const [
    openSplit,
    setOpenSplit
  ] = useState<string | null>(null);

  const reviewable =
    transactions.filter(
      (item) =>
        item.duplicateState !==
        "duplicate"
    );

  const included =
    reviewable.filter(
      (item) => !item.excluded
    );

  const total =
    included.reduce(
      (sum, item) =>
        sum + item.amountCents,
      0
    );

  const categorized =
    included.filter((item) =>
      item.allocations.every(
        (allocation) =>
          Boolean(
            allocation.bucketId
          )
      )
    ).length;

  const unassigned =
    included.length - categorized;

  const invalid =
    included.filter(
      (item) =>
        !transactionIsValidSplit(
          item.amountCents,
          item.allocations
        )
    );

  const update = (
    tempId: string,
    patch:
      Partial<ParsedTransaction>
  ) => {
    updateTransactions(
      transactions.map(
        (item) =>
          item.tempId === tempId
            ? {
                ...item,
                ...patch
              }
            : item
      )
    );
  };

  const setBucket = (
    item: ParsedTransaction,
    bucketId: string | null
  ) => {
    update(item.tempId, {
      allocations: [
        {
          bucketId,
          amountCents:
            item.amountCents
        }
      ]
    });
  };

  const setAllocations = (
    item: ParsedTransaction,
    allocations:
      TransactionAllocation[]
  ) => {
    update(item.tempId, {
      allocations
    });
  };

  const applyHighConfidence =
    () => {
      updateTransactions(
        transactions.map(
          (item) => {
            const bucketId =
              item.suggestion
                ?.bucketId;

            const confidence =
              item.suggestion
                ?.confidence ?? 0;

            if (
              !bucketId ||
              confidence < 0.8
            ) {
              return item;
            }

            return {
              ...item,
              allocations: [
                {
                  bucketId,
                  amountCents:
                    item.amountCents
                }
              ]
            };
          }
        )
      );
    };

  const save = async () => {
    if (!user) {
      return;
    }

    if (invalid.length) {
      setError(
        "Fix the split totals before saving."
      );

      return;
    }

    setSaving(true);
    setError(null);

    try {
      const items =
        included.map((item) =>
          makeTransaction({
            postDate:
              item.postDate,
            rawDescription:
              item.rawDescription,
            normalizedMerchant:
              item.normalizedMerchant,
            displayMerchant:
              item.displayMerchant,
            amountCents:
              item.amountCents,
            runningBalanceCents:
              item.runningBalanceCents,
            source: item.source,
            sourceFingerprint:
              item.sourceFingerprint,
            allocations:
              item.allocations,
            user
          })
        );

      await saveManyTransactions(
        items,
        {
          feedbackKind:
            "accepted"
        }
      );

      clear();
      navigate("/transactions");
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The transactions could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!transactions.length) {
    return (
      <div className="page">
        <section className="empty-card">
          <h2>
            No import waiting for review
          </h2>

          <button
            type="button"
            className="primary-button"
            onClick={() =>
              navigate("/add")
            }
          >
            Return to Add
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="page import-review-page">
      <section className="page-heading">
        <h1>Review import</h1>

        <p>
          North&apos;s Budget App assigned as much as it could from your rules and past choices. Confirm before saving.
        </p>
      </section>

      {error && (
        <StatusMessage tone="error">
          {error}
        </StatusMessage>
      )}

      <section className="import-summary-card">
        <div>
          <strong>
            {summary.rowsRead}
          </strong>

          <span>rows read</span>
        </div>

        <div>
          <strong>
            {
              summary
                .duplicatesSkipped
            }
          </strong>

          <span>
            duplicates skipped
          </span>
        </div>

        <div>
          <strong>
            {summary.positiveIgnored}
          </strong>

          <span>
            positive ignored
          </span>
        </div>

        <div>
          <strong>
            {
              summary
                .incompleteSkipped
            }
          </strong>

          <span>
            incomplete skipped
          </span>
        </div>
      </section>

      {summary.possibleDuplicates >
        0 && (
        <StatusMessage tone="warning">
          {
            summary
              .possibleDuplicates
          }{" "}
          possible duplicates need extra attention.
        </StatusMessage>
      )}

      <div className="review-tools">
        <button
          type="button"
          className="secondary-button"
          onClick={
            applyHighConfidence
          }
        >
          <Sparkles />

          Auto-fill suggestions
        </button>
      </div>

      <div className="review-list">
        {reviewable.map(
          (item) => {
            const suggestedBucket =
              buckets.find(
                (bucket) =>
                  bucket.id ===
                  item.suggestion
                    ?.bucketId
              );

            return (
              <article
                className={[
                  "review-card",
                  item.excluded
                    ? "excluded"
                    : "",
                  item.duplicateState ===
                  "possible"
                    ? "possible-duplicate"
                    : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={item.tempId}
              >
                <div className="review-card-head">
                  <div>
                    <strong>
                      {
                        item.displayMerchant
                      }
                    </strong>

                    <small>
                      {item.postDate}
                      {" · "}
                      {item.source.replace(
                        "uccu-",
                        ""
                      )}
                    </small>
                  </div>

                  <strong>
                    {formatCurrency(
                      item.amountCents
                    )}
                  </strong>
                </div>

                {item.duplicateState ===
                  "possible" && (
                  <div className="inline-warning">
                    <AlertTriangle />

                    Possible duplicate. Review before saving.
                  </div>
                )}

                <details className="review-details">
                  <summary>Details</summary>

                  <label>
                    Budget date

                    <input
                      type="date"
                      value={item.postDate}
                      onChange={(event) =>
                        update(
                          item.tempId,
                          {
                            postDate:
                              event.target.value
                          }
                        )
                      }
                    />
                  </label>

                  <p className="raw-description">
                    {
                      item.rawDescription
                    }
                  </p>
                </details>

                {item.suggestion
                  ?.bucketId && (
                  <div className="suggestion-note">
                    <Sparkles />

                    <span>
                      <strong>
                        {
                          suggestedBucket
                            ?.emoji
                        }{" "}
                        {
                          suggestedBucket
                            ?.name
                        }
                      </strong>

                      <small>
                        {Math.round(
                          item.suggestion
                            .confidence *
                            100
                        )}
                        % match
                      </small>
                    </span>
                  </div>
                )}
                {openSplit ===
                item.tempId ? (
                  <SplitEditor
                    amountCents={
                      item.amountCents
                    }
                    allocations={
                      item.allocations
                    }
                    buckets={buckets}
                    onChange={(
                      allocations
                    ) =>
                      setAllocations(
                        item,
                        allocations
                      )
                    }
                  />
                ) : (
                  <label>
                    Bucket

                    <select
                      value={
                        item
                          .allocations[0]
                          ?.bucketId ?? ""
                      }
                      disabled={
                        item.excluded
                      }
                      onChange={(
                        event
                      ) =>
                        setBucket(
                          item,
                          event.target
                            .value ||
                            null
                        )
                      }
                    >
                      <option value="">
                        Unassigned
                      </option>

                      {buckets.map(
                        (bucket) => (
                          <option
                            key={
                              bucket.id
                            }
                            value={
                              bucket.id
                            }
                          >
                            {
                              bucket.emoji
                            }{" "}
                            {
                              bucket.name
                            }
                          </option>
                        )
                      )}
                    </select>
                  </label>
                )}

                <div className="review-actions">
                  <button
                    type="button"
                    className="text-button"
                    disabled={
                      item.excluded
                    }
                    onClick={() =>
                      setOpenSplit(
                        openSplit ===
                          item.tempId
                          ? null
                          : item.tempId
                      )
                    }
                  >
                    {openSplit ===
                    item.tempId
                      ? "Use one bucket"
                      : "Split"}
                  </button>

                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      update(
                        item.tempId,
                        {
                          excluded:
                            !item.excluded
                        }
                      )
                    }
                  >
                    {item.excluded
                      ? "Include"
                      : "Exclude"}
                  </button>
                </div>
              </article>
            );
          }
        )}
      </div>

      <section className="sticky-save-panel">
        <div>
          <strong>
            {included.length}{" "}
            transactions ·{" "}
            {formatCurrency(total)}
          </strong>

          <span>
            {categorized} categorized ·{" "}
            {unassigned} unassigned
          </span>
        </div>

        <button
          type="button"
          className="primary-button"
          disabled={
            saving ||
            !included.length ||
            invalid.length > 0
          }
          onClick={save}
        >
          {saving
            ? "Saving…"
            : "Save import"}
        </button>
      </section>

      {included.length > 0 &&
        unassigned === 0 && (
          <div className="all-set">
            <CheckCircle2 />

            Everything is categorized.
          </div>
        )}
    </div>
  );
}
