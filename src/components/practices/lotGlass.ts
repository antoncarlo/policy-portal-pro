// Stile del ciclo del lotto: vetro smerigliato su uno sfondo tenue nei colori del marchio (blu notte e bronzo).
// Poche regole, sempre le stesse: superfici traslucide con un filo di luce sul bordo, ombre morbide, titoli in Lora.

/** Lo sfondo su cui il vetro si legge: un velo di blu e di bronzo, nessun colore in piu'. */
export const STAGE =
  "relative isolate overflow-hidden rounded-2xl border border-white/50 bg-gradient-to-br from-[#e8eef3] via-[#f3efe9] to-[#dde6ee] p-4 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_18px_50px_-24px_rgba(15,58,92,0.35)] sm:p-6 dark:border-white/10 dark:from-[#0d1b27] dark:via-[#121c26] dark:to-[#0b1722]";

/** Una superficie di vetro: traslucida, sfocata, con il bordo chiaro in alto. */
export const GLASS =
  "rounded-xl border border-white/60 bg-white/55 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_10px_30px_-18px_rgba(15,58,92,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-none";

/** Vetro piu' quieto, per elenchi e righe dentro un altro vetro. */
export const GLASS_INSET = "rounded-lg border border-white/50 bg-white/40 dark:border-white/10 dark:bg-white/[0.04]";

/** Pulsante secondario: vetro con un filo di bordo. */
export const GLASS_BUTTON =
  "border-white/70 bg-white/60 text-foreground shadow-sm backdrop-blur hover:bg-white/85 dark:border-white/15 dark:bg-white/10 dark:hover:bg-white/20";

/** Pulsante principale: blu notte pieno, con un riflesso sottile. */
export const PRIMARY_BUTTON =
  "bg-primary text-primary-foreground shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_18px_-10px_rgba(15,58,92,0.8)] hover:bg-primary/90";

/** La scheda dei popup: vetro piu' denso, per leggere bene i campi. */
export const DIALOG_GLASS =
  "border border-white/60 bg-white/80 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_30px_80px_-30px_rgba(15,58,92,0.55)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/80";

export const EYEBROW = "text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(30,32%,42%)] dark:text-[hsl(30,35%,68%)]";
export const SERIF = "font-serif tracking-tight";
