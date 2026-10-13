import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileSignature, Loader2, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SIGNING_SLOTS, SIGNING_TEMPLATES_BUCKET, signingTemplatePath, type SigningSlotId } from "@/lib/signingDocuments";
import { downloadSigningTemplate, listSigningTemplates, saveBlob, type TemplateInfo } from "@/lib/signingTemplates";
import { generateSigningDocument } from "@/lib/signingPrefillData";
import { formatDate, getMessages, useMessages } from "@/i18n";
import { signingMessages } from "@/i18n/messages/signing";

const MAX_TEMPLATE_BYTES = 15 * 1024 * 1024;

/** Impostazioni (amministratori): i modelli PDF dei documenti da firmare. */
export const SigningTemplatesSettings = () => {
  const m = useMessages(signingMessages);
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Map<SigningSlotId, TemplateInfo>>(new Map());
  const [busy, setBusy] = useState<SigningSlotId | null>(null);

  const load = async () => setTemplates(await listSigningTemplates());

  useEffect(() => {
    void load();
  }, []);

  const fail = (error: unknown) =>
    toast({ variant: "destructive", title: getMessages(signingMessages).settings.errorTitle, description: error instanceof Error ? error.message : undefined });

  const upload = async (slot: SigningSlotId, file: File) => {
    const text = getMessages(signingMessages).settings;
    if (!(file.type === "application/pdf" || /\.pdf$/i.test(file.name))) return fail(new Error(text.onlyPdf));
    if (file.size > MAX_TEMPLATE_BYTES) return fail(new Error(text.tooBig));
    setBusy(slot);
    try {
      const { error } = await supabase.storage
        .from(SIGNING_TEMPLATES_BUCKET)
        .upload(signingTemplatePath(slot), file, { contentType: "application/pdf", upsert: true });
      if (error) throw new Error(error.message);
      toast({ title: text.savedTitle, description: text.savedText(m.slots[slot].label) });
      await load();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (slot: SigningSlotId) => {
    const text = getMessages(signingMessages).settings;
    if (!window.confirm(text.confirmRemove(m.slots[slot].label))) return;
    setBusy(slot);
    try {
      const { error } = await supabase.storage.from(SIGNING_TEMPLATES_BUCKET).remove([signingTemplatePath(slot)]);
      if (error) throw new Error(error.message);
      toast({ title: text.removedTitle });
      await load();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  };

  const download = async (slot: SigningSlotId) => {
    try {
      const builtIn = SIGNING_SLOTS.find((entry) => entry.id === slot)?.builtIn;
      saveBlob(builtIn ? await generateSigningDocument(slot) : await downloadSigningTemplate(slot), `${slot}.pdf`);
    } catch (error) {
      fail(error);
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-1 flex items-center gap-2">
        <FileSignature className="h-5 w-5" />
        <h2 className="text-xl font-semibold">{m.settings.title}</h2>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">{m.settings.intro}</p>

      <ul className="space-y-3">
        {SIGNING_SLOTS.map((slot) => {
          const template = templates.get(slot.id);
          const inputId = `signing-template-${slot.id}`;
          return (
            <li key={slot.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between" data-testid={`signing-template-${slot.id}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{m.slots[slot.id].label}</p>
                  {slot.builtIn ? (
                    <Badge variant="outline" className="border-green-500/40 text-green-700 dark:text-green-400">{m.settings.builtIn}</Badge>
                  ) : slot.hasTemplate ? (
                    template ? (
                      <Badge variant="outline" className="border-green-500/40 text-green-700 dark:text-green-400">{m.settings.uploadedOn(formatDate(template.updatedAt ?? ""))}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 dark:text-amber-400">{m.settings.noTemplate}</Badge>
                    )
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">{m.settings.noTemplateNeeded}</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{m.slots[slot.id].description}</p>
              </div>
              {slot.builtIn && (
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Button variant="outline" size="sm" onClick={() => void download(slot.id)}>
                    <Download className="mr-1.5 h-4 w-4" />
                    {m.settings.downloadBlank}
                  </Button>
                </div>
              )}
              {slot.hasTemplate && !slot.builtIn && (
                <div className="flex flex-wrap gap-2 md:justify-end">
                  {template && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => void download(slot.id)}>
                        <Download className="mr-1.5 h-4 w-4" />
                        {m.settings.download}
                      </Button>
                      <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => void remove(slot.id)}>
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        {m.settings.remove}
                      </Button>
                    </>
                  )}
                  <input
                    id={inputId}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void upload(slot.id, file);
                    }}
                  />
                  <Button asChild size="sm" variant={template ? "outline" : "default"} disabled={busy !== null}>
                    <label htmlFor={inputId} className="cursor-pointer">
                      {busy === slot.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
                      {template ? m.settings.replace : m.settings.upload}
                    </label>
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
};
