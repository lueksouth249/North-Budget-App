const read = (name: string): string => String(import.meta.env[name] ?? "").trim();

export const env = {
  firebase: {
    apiKey: read("VITE_FIREBASE_API_KEY"),
    authDomain: read("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: read("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: read("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: read("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: read("VITE_FIREBASE_APP_ID")
  },
  householdId: read("VITE_HOUSEHOLD_ID") || "north-budget-household",
  approvedEmails: [read("VITE_APPROVED_EMAIL_1"), read("VITE_APPROVED_EMAIL_2")]
    .map((email) => email.toLowerCase())
    .filter(Boolean)
};

export const firebaseConfigured = Boolean(
  env.firebase.apiKey && env.firebase.authDomain && env.firebase.projectId && env.firebase.appId
);
