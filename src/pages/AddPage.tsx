import {
  FileSpreadsheet,
  ImagePlus,
  PlusCircle,
  Sparkles
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent
} from "react";
import {
  useNavigate,
  useSearchParams
} from "react-router-dom";
import { SplitEditor } from "../components/SplitEditor";
import { StatusMessage } from "../components/StatusMessage";
import {
  makeTransaction,
  useAppData
} from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { useImportSession } from "../context/ImportContext";
import { parseUccuWorkbook } from "../features/imports/excelParser";
import { parseUccuScreenshots } from "../features/imports/ocrParser";
import { prepareImportedTransactions } from "../features/imports/prepareImport";
import { transactionIsValidSplit } from "../lib/budget";
import {
  dollarsToCents,
  formatCurrency
} from "../lib/currency";
import {
  monthIdFromDate,
  todayIso
} from "../lib/dates";
import { normalizeMerchant } from "../lib/merchant";
import { getCategorySuggestion } from "../lib/rules";
import type { TransactionAllocation } from "../types/models";

export function AddPage() {
  const { user } = useAuth();

  const {
    buckets,
    rules,
    profiles,
    saveOneTransaction,
    fetchExistingTransactions
  } = useAppData();

  const { setImport } = useImportSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedBucketId =
    searchParams.get("bucket");

  const [date, setDate] = useState(
    todayIso()
  );

  const [
    description,
    setDescription
  ] = useState("");

  const [
    amount,
    setAmount
  ] = useState("");

  const [
    bucketId,
    setBucketId
  ] = useState<string | null>(null);

  const [
    appliedBucketParam,
    setAppliedBucketParam
  ] = useState<string | null>(null);

  const [
    note,
    setNote
  ] = useState("");

  const [
    split,
    setSplit
  ] = useState(false);

  const [
    allocations,
    setAllocations
  ] = useState<TransactionAllocation[]>([
    {
      bucketId: null,
      amountCents: 0
    }
  ]);

  const [
    message,
    setMessage
  ] = useState<{
    tone:
      | "error"
      | "success"
      | "info";
    text: string;
  } | null>(null);

  const [
    working,
    setWorking
  ] = useState(false);

  const [
    ocrProgress,
    setOcrProgress
  ] = useState("");

  const amountCents = useMemo(() => {
    try {
      return amount
        ? Math.abs(
            dollarsToCents(amount)
          )
        : 0;
    } catch {
      return 0;
    }
  }, [amount]);

  useEffect(() => {
    if (!requestedBucketId) {
      return;
    }

    if (
      requestedBucketId ===
      appliedBucketParam
    ) {
      return;
    }

    if (
      !buckets.some(
        (bucket) =>
          bucket.id === requestedBucketId
      )
    ) {
      return;
    }

    setSplit(false);
    setBucketId(requestedBucketId);
    setAllocations([
      {
        bucketId: requestedBucketId,
        amountCents
      }
    ]);
    setAppliedBucketParam(
      requestedBucketId
    );
  }, [
    requestedBucketId,
    buckets,
    amountCents,
    appliedBucketParam
  ]);

  const merchant = useMemo(
    () =>
      normalizeMerchant(description),
    [description]
  );

  const suggestion = useMemo(() => {
    if (
      !description ||
      amountCents <= 0
    ) {
      return null;
    }

    return getCategorySuggestion({
      merchantKey:
        merchant.normalizedMerchant,
      amountCents,
      rules,
      profiles
    });
  }, [
    description,
    amountCents,
    merchant.normalizedMerchant,
    rules,
    profiles
  ]);

  const applySuggestion = () => {
    if (!suggestion?.bucketId) {
      return;
    }

    setBucketId(
      suggestion.bucketId
    );

    setAllocations([
      {
        bucketId:
          suggestion.bucketId,
        amountCents
      }
    ]);
  };

  const submitManual = async (
    event: FormEvent
  ) => {
    event.preventDefault();

    if (!user) {
      return;
    }

    if (
      !description.trim() ||
      amountCents <= 0
    ) {
      setMessage({
        tone: "error",
        text: "Enter a merchant and a positive amount."
      });

      return;
    }

    const finalAllocations = split
      ? allocations
      : [
          {
            bucketId,
            amountCents
          }
        ];

    if (
      !transactionIsValidSplit(
        amountCents,
        finalAllocations
      )
    ) {
      setMessage({
        tone: "error",
        text: "The allocation amounts must exactly match the transaction amount."
      });

      return;
    }

    setWorking(true);
    setMessage(null);

    try {
      const transaction =
        makeTransaction({
          postDate: date,
          rawDescription:
            description.trim(),
          ...merchant,
          amountCents,
          allocations:
            finalAllocations,
          source: "manual",
          note,
          user
        });

      const wasSuggested =
        Boolean(
          suggestion?.bucketId &&
            finalAllocations.length ===
              1 &&
            finalAllocations[0]
              .bucketId ===
              suggestion.bucketId
        );

      await saveOneTransaction(
        transaction,
        {
          feedbackKind:
            wasSuggested
              ? "accepted"
              : suggestion?.bucketId
                ? "corrected"
                : "manual",
          suggestedBucketId:
            suggestion?.bucketId
        }
      );

      setDescription("");
      setAmount("");
      setBucketId(null);
      setNote("");
      setSplit(false);

      setAllocations([
        {
          bucketId: null,
          amountCents: 0
        }
      ]);

      setMessage({
        tone: "success",
        text: "Transaction saved. North's Budget App learned from this assignment."
      });
    } catch (error: unknown) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "The transaction could not be saved."
      });
    } finally {
      setWorking(false);
    }
  };

  const processImport = async (
    files: File[],
    kind:
      | "excel"
      | "screenshots"
  ) => {
    setWorking(true);
    setMessage(null);
    setOcrProgress("");

    try {
      if (!files.length) {
        throw new Error(
          "Select at least one file to import."
        );
      }

      const result =
        kind === "excel"
          ? await parseUccuWorkbook(
              files[0]
            )
          : await parseUccuScreenshots(
              files,
              (
                text,
                progress
              ) => {
                setOcrProgress(
                  `${text} ${Math.round(
                    progress * 100
                  )}%`
                );
              }
            );

      const monthIds = [
        ...new Set(
          result.transactions.map(
            (transaction) =>
              monthIdFromDate(
                transaction.postDate
              )
          )
        )
      ];

      const existing =
        await fetchExistingTransactions(
          monthIds
        );

      const prepared =
        prepareImportedTransactions({
          parsed:
            result.transactions,
          existing,
          rules,
          profiles
        });

      const duplicates =
        prepared.filter(
          (item) =>
            item.duplicateState ===
            "duplicate"
        ).length;

      const possible =
        prepared.filter(
          (item) =>
            item.duplicateState ===
            "possible"
        ).length;

      setImport(prepared, {
        ...result.summary,
        duplicatesSkipped:
          result.summary
            .duplicatesSkipped +
          duplicates,
        possibleDuplicates:
          possible,
        newDebits:
          prepared.filter(
            (item) =>
              item.duplicateState !==
              "duplicate"
          ).length
      });

      navigate("/import/review");
    } catch (error: unknown) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "The import failed."
      });
    } finally {
      setWorking(false);
      setOcrProgress("");
    }
  };

  return (
    <div className="page add-page">
      <section className="page-heading">
        <h1>Add spending</h1>

        <p>
          Record one transaction or import from UCCU.
        </p>
      </section>

      {message && (
        <StatusMessage
          tone={message.tone}
        >
          {message.text}
        </StatusMessage>
      )}

      <section className="form-card">
        <div className="section-title">
          <PlusCircle />

          <div>
            <h2>
              Manual transaction
            </h2>

            <p>
              North&apos;s Budget App learns every time you confirm a category.
            </p>
          </div>
        </div>

        <form onSubmit={submitManual}>
          <label>
            Date

            <input
              type="date"
              value={date}
              onChange={(event) =>
                setDate(
                  event.target.value
                )
              }
              required
            />
          </label>

          <label>
            Merchant or description

            <input
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value
                )
              }
              placeholder="Smith's"
              required
            />
          </label>

          <label>
            Amount

            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(event) => {
                const nextAmount =
                  event.target.value;

                setAmount(nextAmount);

                let cents = 0;

                try {
                  cents = Math.abs(
                    dollarsToCents(
                      nextAmount
                    )
                  );
                } catch {
                  cents = 0;
                }

                if (split) {
                  setAllocations(
                    (items) =>
                      items.length ===
                      1
                        ? [
                            {
                              ...items[0],
                              amountCents:
                                cents
                            }
                          ]
                        : items
                  );
                }
              }}
              placeholder="0.00"
              required
            />
          </label>

          {suggestion?.bucketId && (
            <button
              type="button"
              className="learning-suggestion"
              onClick={
                applySuggestion
              }
            >
              <Sparkles />

              <span>
                <strong>
                  Suggested:{" "}
                  {
                    buckets.find(
                      (bucket) =>
                        bucket.id ===
                        suggestion.bucketId
                    )?.emoji
                  }{" "}
                  {
                    buckets.find(
                      (bucket) =>
                        bucket.id ===
                        suggestion.bucketId
                    )?.name
                  }
                </strong>

                <small>
                  {suggestion.reason}
                  {" · "}
                  {Math.round(
                    suggestion.confidence *
                      100
                  )}
                  % confidence
                </small>
              </span>
            </button>
          )}

          {!split ? (
            <label>
              Bucket

              <select
                value={bucketId ?? ""}
                onChange={(event) =>
                  setBucketId(
                    event.target.value ||
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
                      key={bucket.id}
                      value={bucket.id}
                    >
                      {bucket.emoji}{" "}
                      {bucket.name}
                    </option>
                  )
                )}
              </select>
            </label>
          ) : (
            <SplitEditor
              amountCents={
                amountCents
              }
              allocations={
                allocations
              }
              buckets={buckets}
              onChange={
                setAllocations
              }
            />
          )}

          <button
            type="button"
            className="text-button"
            onClick={() => {
              const next = !split;

              setSplit(next);

              setAllocations(
                next
                  ? [
                      {
                        bucketId,
                        amountCents
                      }
                    ]
                  : [
                      {
                        bucketId:
                          null,
                        amountCents: 0
                      }
                    ]
              );
            }}
          >
            {split
              ? "Use one bucket"
              : "Split across buckets"}
          </button>

          <label>
            Note{" "}
            <span className="optional">
              optional
            </span>

            <textarea
              value={note}
              onChange={(event) =>
                setNote(
                  event.target.value
                )
              }
              rows={2}
            />
          </label>

          <button
            type="submit"
            className="primary-button wide"
            disabled={working}
          >
            {working
              ? "Saving…"
              : `Save ${
                  amountCents
                    ? formatCurrency(
                        amountCents
                      )
                    : "transaction"
                }`}
          </button>
        </form>
      </section>

      <section className="import-grid">
        <label className="import-card">
          <FileSpreadsheet />

          <strong>
            Import UCCU Excel
          </strong>

          <span>
            Use the original .xls export from your computer.
          </span>

          <input
            type="file"
            accept=".xls,.xlsx"
            disabled={working}
            onChange={(event) => {
              const file =
                event.target
                  .files?.[0];

              if (file) {
                void processImport(
                  [file],
                  "excel"
                );
              }
            }}
          />
        </label>

        <label className="import-card">
          <ImagePlus />

          <strong>
            Import screenshots
          </strong>

          <span>
            Upload up to five UCCU mobile screenshots.
          </span>

          <input
            type="file"
            accept="image/*"
            multiple
            disabled={working}
            onChange={(event) => {
              if (
                event.target.files
              ) {
                void processImport(
                  [
                    ...event.target
                      .files
                  ].slice(0, 5),
                  "screenshots"
                );
              }
            }}
          />
        </label>
      </section>

      {ocrProgress && (
        <StatusMessage tone="info">
          {ocrProgress}
        </StatusMessage>
      )}
    </div>
  );
}
