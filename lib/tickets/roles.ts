// Staff roles and what each may do.
//
// Deliberately its own module with no imports: the console is a Client
// Component and needs these predicates to decide which buttons to render.
// Keeping them next to `resolveStaff` in access.ts would drag `next/headers`
// into the browser bundle — the build rejects exactly that, and it is the
// right rejection.
//
// These predicates are UI affordances. The authoritative check runs again in
// every API route; a hidden button is not a permission.

export type StaffRole = "reviewer" | "supervisor" | "finance" | "admin";

/**
 * Roles that may decide a claim. `finance` is excluded on purpose: it moves
 * payouts, it does not judge receipts (brief §10, separated roles).
 */
export const canReview = (role: StaffRole) =>
  role === "reviewer" || role === "supervisor" || role === "admin";

/** Roles that may move a reward along its delivery states. */
export const canPayout = (role: StaffRole) =>
  role === "finance" || role === "supervisor" || role === "admin";
