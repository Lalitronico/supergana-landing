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

/**
 * Roles that may curate the prize store: open and close the weekly Drop, price
 * its prizes, set inventory, and mark a redemption delivered.
 *
 * Narrower than reviewing on purpose. A reviewer decides whether one receipt is
 * real; inventory decides how much the campaign gives away this week, and every
 * seat with that power is a seat that can empty the Drop. `finance` is out for
 * the same reason it cannot review: it settles what was promised, it does not
 * decide the promise. Reading the store needs no predicate — any seat on the
 * campaign already sees the console.
 */
export const canManageStore = (role: StaffRole) =>
  role === "supervisor" || role === "admin";
