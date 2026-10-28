// Errors of the Anthropic API that stop the agents for every document, not for one: the portal then stops the
// reading and says why, instead of reporting each document as unreadable and asking the client for new copies.

/** Out of credit: 402 billing_error, or the 400 "Your credit balance is too low…" the API answers today. */
export const isOutOfCredit = (status: number | undefined, message: string) => status === 402 || /credit balance/i.test(message);

export const NO_CREDIT_MESSAGE = "Credito API dell'agent esaurito: l'amministratore del portale deve ricaricarlo nella Console Anthropic";
