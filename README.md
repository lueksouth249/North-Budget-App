# North Budget

North Budget is an iPhone-first, shared spending budget for two people. It is a static React application hosted on GitHub Pages with Google sign-in and Cloud Firestore synchronization.

## What is included

- Separate Google sign-ins for two approved users
- Near-real-time Firestore synchronization
- July 2026 seed budget totaling **$3,397.23**
- Editable monthly buckets with clean-slate month copying
- Manual transactions and secondary split-transaction editing
- UCCU legacy `.xls` import
- UCCU mobile screenshot OCR import, up to five screenshots per batch
- Positive transaction/deposit exclusion
- Unified import review and duplicate detection
- Robust history-based auto-categorization
- Explicit merchant and merchant-plus-amount rules
- Current, three-month, and six-month reports
- JSON backup and restore
- Installable PWA for iPhone
- Local demo mode when Firebase is not configured

## How automatic categorization learns

North Budget has two complementary systems:

1. **Explicit rules** override everything. These can match a merchant alone or a merchant plus an exact/ranged amount.
2. **Learned merchant profiles** update whenever a user confirms a single-bucket transaction.

A merchant can auto-fill after only one manual assignment. For example, once Chick-fil-A is manually assigned to `💌 Date Money`, the next exact Chick-fil-A match receives a high-confidence Date Money suggestion.

For merchants used for more than one purpose, the scorer considers:

- weighted bucket frequency
- exact merchant history
- amount mean and variance by bucket
- amount closeness
- recent assignments
- user corrections and rejected suggestions
- fuzzy merchant similarity for slightly changed bank descriptions

Manual assignments and corrections carry more weight than accepted automatic suggestions. Split transactions do not train the learner because there is no single correct bucket. The Settings page includes **Rebuild from transaction history** if learning profiles ever need to be regenerated.

Imported transactions are still reviewed before saving. High-confidence suggestions are preselected and can be accepted in bulk.

## Local setup

Requirements:

- Node.js 22 or later
- npm
- A Firebase project for shared use

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without Firebase values, the app opens in local demo mode. Demo data stays in that browser and does not sync.

## Firebase setup

### 1. Create a project

Create a Firebase project and add a Web app. Copy the Web configuration values into `.env.local`:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_HOUSEHOLD_ID=north-budget-household
VITE_APPROVED_EMAIL_1=first@gmail.com
VITE_APPROVED_EMAIL_2=second@gmail.com
```

Firebase Web configuration values are identifiers used by the browser and are not treated as server secrets. Security comes from Authentication and Firestore rules. Never commit service-account JSON files, private keys, or Firebase CLI access tokens.

### 2. Enable Google sign-in

In Firebase Console:

1. Open **Authentication**.
2. Choose **Sign-in method**.
3. Enable **Google**.
4. Set the support email.

### 3. Create Firestore

Create a Cloud Firestore database. Production mode is recommended because the included rules deny all access except the two approved accounts and one household path.

### 4. Configure Firestore rules

Open `firestore.rules` and replace:

- `APPROVED_EMAIL_1`
- `APPROVED_EMAIL_2`
- `HOUSEHOLD_ID`

with the same values used in your environment variables.

Install Firebase CLI if needed:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes
```

The rules require:

- an authenticated user
- a verified email
- an email matching one of the two approved addresses
- access only beneath the configured household document

### 5. Authorized domains

In Firebase Authentication settings, add:

- `localhost`
- your GitHub Pages host, such as `username.github.io`
- any custom domain used later

## GitHub Pages deployment

### 1. Create the repository

```bash
git init
git add .
git commit -m "Build North Budget"
git branch -M main
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

### 2. Add GitHub Actions secrets

In **Repository Settings → Secrets and variables → Actions**, add:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_HOUSEHOLD_ID`
- `VITE_APPROVED_EMAIL_1`
- `VITE_APPROVED_EMAIL_2`

### 3. Enable Pages

In **Settings → Pages**, select **GitHub Actions** as the source. Pushing to `main` runs tests, builds the app, and publishes `dist`.

The app uses hash routing and a relative Vite base, so a repository Pages URL works without special server rewrite rules.

## Install on iPhone

1. Open the deployed site in Safari.
2. Tap the Share button.
3. Choose **Add to Home Screen**.
4. Open North Budget from the new icon.

The PWA caches static app assets. Firestore supports local persistence and syncs queued changes after connectivity returns. The interface displays `Saving…` until writes are being processed; users should not assume the other phone received an update while offline.

## UCCU Excel import

Use the original UCCU `.xls` export without reformatting it. The parser finds columns by name:

- Account Number
- Post Date
- Check
- Description
- Debit
- Credit
- Status
- Balance
- Classification

Only posted debit rows are imported. Credits, deposits, and other positive rows are ignored. The account number is never stored.

The duplicate fingerprint uses:

- post date
- normalized raw description
- amount
- running balance

## UCCU screenshot import

The importer accepts up to five screenshots. OCR happens locally in the browser using Tesseract.js. Images are not uploaded or saved.

A valid row needs:

- full uppercase date
- visible description
- debit amount in parentheses
- running balance

Cropped top/bottom rows are skipped. Positive amounts without parentheses are ignored. The review screen reports skipped and duplicate rows.

OCR is inherently less reliable than the Excel export. Every screenshot import goes through manual review before saving.

## Backup and restore

Settings can download a JSON backup containing:

- month budgets
- transactions
- rules
- learned merchant profiles
- default template

Original bank files, screenshots, Firebase credentials, and authentication tokens are not included.

Restore supports merging or replacing current data. A schema-version check runs before any restore.

## Commands

```bash
npm run dev       # local development
npm test          # utility and parsing tests
npm run build     # TypeScript check and production build
npm run preview   # preview the production build
```

## Manual QA checklist

### Authentication and sync

- [ ] Sign in with the first approved Google account
- [ ] Sign in on a second phone with the second approved account
- [ ] Verify an unapproved account is rejected
- [ ] Add a transaction on one phone and confirm it appears on the other
- [ ] Edit and delete from both devices

### Budget behavior

- [ ] July 2026 totals exactly $3,397.23
- [ ] Add, rename, reorder, move, and delete buckets
- [ ] Delete a used bucket and verify its spending moves to Unassigned
- [ ] Create a new month from previous, template, and blank
- [ ] Confirm no balance or spending rolls over

### Learning

- [ ] Manually assign Chick-fil-A to Date Money
- [ ] Add Chick-fil-A again and verify Date Money auto-fills
- [ ] Correct a suggestion and verify future confidence shifts
- [ ] Create two Venmo amount patterns and verify amount-sensitive assignment
- [ ] Verify Discover always suggests Credit Card
- [ ] Rebuild profiles from history

### Imports

- [ ] Import the original UCCU `.xls`
- [ ] Verify credits and deposits are ignored
- [ ] Re-import the same file and verify duplicates are skipped
- [ ] Import five overlapping screenshots
- [ ] Verify positive screenshot rows and cropped rows are skipped
- [ ] Verify Excel and screenshot copies of the same transaction match
- [ ] Review, split, exclude, and batch-assign imported transactions

### PWA and offline

- [ ] Add to Home Screen from iPhone Safari
- [ ] Verify safe-area spacing and 44px touch targets
- [ ] Open while offline and view cached app shell/data
- [ ] Add a transaction offline, reconnect, and verify synchronization
- [ ] Refresh every hash route on GitHub Pages

### Backup

- [ ] Download a backup
- [ ] Merge the backup
- [ ] Replace data from the backup
- [ ] Reject an invalid or wrong-version JSON file

## Security notes

- Do not deploy until `firestore.rules` placeholders are replaced.
- Do not put service-account credentials in the project.
- Keep the GitHub repository private if desired, but remember the deployed static JavaScript is always visible to browsers.
- Firestore rules—not hidden JavaScript—are the real access control.
- XLSX parsing is performed only on user-selected local files. Keep dependencies updated and only import files downloaded directly from UCCU.
