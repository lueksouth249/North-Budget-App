# North's Budget App

North's Budget App is an iPhone-first shared spending budget for Luke and Kimmi. It is a static React application hosted on GitHub Pages with Google sign-in and Cloud Firestore synchronization.

## What is included

- Separate Google sign-ins for two approved users
- Near-real-time Firestore synchronization
- July 2026 seed budget totaling **$3,397.23**
- Editable monthly buckets with clean-slate month copying
- Manual transactions and optional split-transaction editing
- UCCU legacy `.xls` import
- UCCU mobile screenshot OCR import, up to five screenshots per batch
- Positive transaction and deposit exclusion
- Unified import review and duplicate detection
- History-based automatic categorization
- Explicit merchant and merchant-plus-amount rules
- Current, three-month, and six-month reports
- JSON backup and restore
- Installable PWA for iPhone
- Local demo mode when Firebase is not configured
- Safe Firestore writes that omit undefined optional fields
- Reliable loading when switching between budget months

## Budget rules

North's Budget App is spending-only and does not track income.

Positive imported transactions, including deposits and transfers into checking, are ignored.

Each month begins as a clean slate. Spending and remaining balances do not roll over from the previous month.

The monthly budget total is calculated from the sum of that month's bucket allocations. The total can change from month to month.

For July 2026, the official budget total is **$3,397.23**.

Imported Discover payments are assigned to the `💳 Credit Card` bucket. The Credit Card allocation can be adjusted manually each month.

Transactions can be manually split across multiple buckets, but splitting is a secondary action. Automatic categorization does not split transactions.

## How automatic categorization learns

North's Budget App has two complementary categorization systems:

1. **Explicit rules** override other suggestions. Rules can match a merchant alone or a merchant combined with an exact or ranged amount.
2. **Learned merchant profiles** update whenever a user confirms a single-bucket transaction.

A merchant can begin receiving suggestions after one manual assignment. For example, once Chick-fil-A is manually assigned to `💌 Date Money`, a future Chick-fil-A transaction can receive a Date Money suggestion.

For merchants used for more than one purpose, the scorer considers:

- Weighted bucket frequency
- Exact merchant history
- Amount mean and variance by bucket
- Amount closeness
- Recent assignments
- User corrections
- Rejected suggestions
- Fuzzy merchant similarity for slightly changed bank descriptions

Manual assignments and corrections carry more weight than accepted automatic suggestions.

Split transactions do not train the learner because they do not have one single correct bucket.

The Settings page includes **Rebuild from transaction history** if learned merchant profiles need to be regenerated.

Imported transactions are reviewed before saving. High-confidence suggestions can be accepted in bulk.

## Transaction storage

Transactions include required fields such as:

- Date
- Merchant description
- Normalized merchant
- Amount
- Source
- Bucket allocations
- User information

Some transaction fields are optional:

- Note
- Running balance
- Source fingerprint

Optional fields are omitted from Firestore writes when they do not have a value. This prevents Excel imports, screenshot imports, and manual transactions from failing because an optional property contains `undefined`.

## Monthly budget loading

Buckets and transactions are loaded separately for the selected month.

North's Budget App waits for both initial Firestore snapshots before displaying the selected month's totals. This prevents transactions from one month from briefly appearing with buckets from another month.

Rules and learned merchant profiles apply to every month, so their Firestore subscriptions remain separate from month-specific subscriptions.

If a month cannot be loaded, the Budget page displays the error and provides a retry button.

## Local setup

### Requirements

- Node.js 22 or later
- npm
- A Firebase project for shared use

Install and start the app:

```bash
npm install
cp .env.example .env.local
npm run dev