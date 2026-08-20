"use client";

import { useTickets } from "../TicketsShell";
import { EmailSignIn } from "./EmailSignIn";
import { PhoneSignIn } from "./PhoneSignIn";

/**
 * The front door, whichever one this campaign has (0030).
 *
 * A switch and nothing else, on purpose. Both screens were written as if the
 * other did not exist — `EmailSignIn` is the file Ticket al Tanque shipped,
 * moved here unchanged — because the way this goes wrong is one screen growing
 * conditionals about the other until neither can be read on its own.
 */
export default function SignInPage() {
  const { campaign } = useTickets();
  return campaign.authChannel === "phone" ? <PhoneSignIn /> : <EmailSignIn />;
}
