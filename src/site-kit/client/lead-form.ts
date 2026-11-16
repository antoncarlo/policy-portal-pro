// Un modulo di richiesta nelle pagine statiche: controlla i campi, invia la richiesta come JSON all'indirizzo del
// modulo (attributo action) e dice com'e' andata. I messaggi sono nell'HTML (attributi data-*), nella lingua della
// pagina. A invio riuscito avvisa il resto della pagina con l'evento «tecno:lead» (lo ascolta la misurazione, solo
// con il consenso). Che cosa leggere, che cosa non va e che cosa inviare lo dice chi usa il modulo.

type State = "idle" | "sending" | "success" | "error" | "invalid";
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export interface LeadFormTools {
  /** Il valore di un campo di testo, o la stringa vuota. */
  text: (name: string) => string;
  /** Lo stato di una casella di spunta. */
  checked: (name: string) => boolean;
}

export interface LeadFormOptions<Values, Problem extends string> {
  /** I valori scritti nel modulo. */
  read: (tools: LeadFormTools) => Values;
  /** Campo per campo, che cosa non va: un oggetto vuoto se il modulo puo' partire. */
  problems: (values: Values) => Partial<Record<string, Problem>>;
  /** Il corpo della richiesta. */
  payload: (values: Values, extra: { website: string; elapsedMs: number }) => unknown;
  /** Il problema da mostrare su un campo che il server ha rifiutato. */
  refused: (field: string) => Problem;
}

export function bindLeadForm<Values, Problem extends string>(form: HTMLFormElement, options: LeadFormOptions<Values, Problem>): void {
  const status = form.querySelector<HTMLElement>("[data-form-status]");
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
  const label = form.querySelector<HTMLElement>("[data-submit-label]");
  if (!status || !button || !label) return;
  // Da quando il modulo e' pronto: un programma lo invia subito, una persona no.
  const readyAt = Date.now();
  // Senza lo script il pulsante resta spento (il server prende solo JSON): da qui in poi il modulo puo' partire.
  button.disabled = false;

  const control = (name: string) => form.elements.namedItem(name) as Control | null;
  const tools: LeadFormTools = {
    text: (name) => control(name)?.value ?? "",
    checked: (name) => (control(name) as HTMLInputElement | null)?.checked === true,
  };

  const setState = (state: State) => {
    form.dataset.state = state;
    status.dataset.state = state;
    status.textContent = state === "success" ? (status.dataset.success ?? "") : state === "error" ? (status.dataset.error ?? "") : state === "invalid" ? (status.dataset.invalid ?? "") : "";
    button.disabled = state === "sending";
    label.textContent = state === "sending" ? (button.dataset.sending ?? "") : (button.dataset.label ?? "");
  };

  const clearErrors = () => {
    for (const message of form.querySelectorAll(".field__error")) message.remove();
    for (const field of form.querySelectorAll("[aria-invalid]")) {
      field.removeAttribute("aria-invalid");
      field.removeAttribute("aria-describedby");
    }
  };
  const showError = (name: string, problem: Problem) => {
    const field = control(name);
    if (!field) return;
    const message = document.createElement("p");
    message.className = "field__error";
    message.id = `${field.id || name}-error`;
    message.textContent = form.dataset[`error${problem.charAt(0).toUpperCase()}${problem.slice(1)}`] ?? "";
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-describedby", message.id);
    field.closest(".field")?.append(message);
  };
  const showErrors = (problems: Partial<Record<string, Problem>>) => {
    clearErrors();
    const names = Object.keys(problems).filter((name) => control(name));
    for (const name of names) showError(name, problems[name] as Problem);
    setState("invalid");
    control(names[0])?.focus();
  };

  // Correggendo un campo il suo errore sparisce.
  const forget = (event: Event) => {
    const field = event.target as HTMLElement;
    if (field.getAttribute("aria-invalid") !== "true") return;
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
    field.closest(".field")?.querySelector(".field__error")?.remove();
  };
  form.addEventListener("input", forget);
  form.addEventListener("change", forget);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.state === "sending") return;
    const values = options.read(tools);
    const problems = options.problems(values);
    if (Object.keys(problems).length > 0) {
      showErrors(problems);
      return;
    }
    clearErrors();
    setState("sending");
    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options.payload(values, { website: tools.text("website"), elapsedMs: Date.now() - readyAt })),
      });
      const answer = (await response.json().catch(() => null)) as { ok?: boolean; fields?: string[] } | null;
      if (response.ok && answer?.ok) {
        form.reset();
        setState("success");
        document.dispatchEvent(new CustomEvent("tecno:lead"));
        return;
      }
      const fields = response.status === 400 && Array.isArray(answer?.fields) ? answer.fields.filter((name) => control(name)) : [];
      if (fields.length > 0) {
        const refused: Partial<Record<string, Problem>> = {};
        for (const name of fields) refused[name] = options.refused(name);
        showErrors(refused);
        return;
      }
      setState("error");
    } catch {
      setState("error");
    }
  });
}
