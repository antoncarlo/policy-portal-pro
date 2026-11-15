// Il modulo contatti: controlla i campi, invia la richiesta a /api/contact e dice com'e' andata. I messaggi sono
// nell'HTML (attributi data-*), nella lingua della pagina. A invio riuscito avvisa il resto della pagina con
// l'evento «tecno:lead» (lo ascolta la misurazione, solo con il consenso).
import { contactPayload, contactProblems, pageLanguage, type ContactField, type ContactProblem, type ContactValues } from "./logic";

type State = "idle" | "sending" | "success" | "error" | "invalid";

export function initContactForm(): void {
  const form = document.querySelector<HTMLFormElement>("form[data-contact-form]");
  if (!form) return;
  const status = form.querySelector<HTMLElement>("[data-form-status]");
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
  const label = form.querySelector<HTMLElement>("[data-submit-label]");
  if (!status || !button || !label) return;
  // Da quando il modulo e' pronto: un programma lo invia subito, una persona no.
  const readyAt = Date.now();

  const control = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
  const text = (name: string) => control(name)?.value ?? "";
  const read = (): ContactValues => ({
    name: text("name"),
    company: text("company"),
    role: text("role"),
    country: text("country"),
    email: text("email"),
    phone: text("phone"),
    volume: text("volume"),
    message: text("message"),
    consent: (control("consent") as HTMLInputElement | null)?.checked === true,
  });

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
  const showError = (name: string, problem: ContactProblem) => {
    const field = control(name);
    if (!field) return;
    const message = document.createElement("p");
    message.className = "field__error";
    message.id = `contact-${name}-error`;
    message.textContent = form.dataset[`error${problem.charAt(0).toUpperCase()}${problem.slice(1)}`] ?? "";
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-describedby", message.id);
    field.closest(".field")?.append(message);
  };
  const showErrors = (problems: Partial<Record<string, ContactProblem>>) => {
    clearErrors();
    const names = Object.keys(problems);
    for (const name of names) showError(name, problems[name] as ContactProblem);
    setState("invalid");
    control(names[0])?.focus();
  };

  // Correggendo un campo il suo errore sparisce.
  form.addEventListener("input", (event) => {
    const field = event.target as HTMLElement;
    if (field.getAttribute("aria-invalid") !== "true") return;
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
    field.closest(".field")?.querySelector(".field__error")?.remove();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.state === "sending") return;
    const values = read();
    const problems = contactProblems(values);
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
        body: JSON.stringify(contactPayload(values, { lang: pageLanguage(document.documentElement.lang), page: window.location.pathname, website: text("website"), elapsedMs: Date.now() - readyAt })),
      });
      const answer = (await response.json().catch(() => null)) as { ok?: boolean; fields?: string[] } | null;
      if (response.ok && answer?.ok) {
        form.reset();
        setState("success");
        document.dispatchEvent(new CustomEvent("tecno:lead"));
        return;
      }
      if (response.status === 400 && Array.isArray(answer?.fields) && answer.fields.length > 0) {
        const refused: Partial<Record<ContactField, ContactProblem>> = {};
        for (const name of answer.fields) refused[name as ContactField] = name === "consent" ? "consent" : name === "email" ? "email" : name === "message" ? "message" : "required";
        showErrors(refused);
        return;
      }
      setState("error");
    } catch {
      setState("error");
    }
  });
}
