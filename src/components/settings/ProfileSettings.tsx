import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatDate, getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { settingsMessages } from "@/i18n/messages/settings";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User, Upload, Camera } from "lucide-react";

export const ProfileSettings = () => {
  const { toast } = useToast();
  const m = useMessages(settingsMessages).profile;
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    phone: "",
    avatar_url: "",
    created_at: "",
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy loader intentionally runs only for the dependency list below
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setProfile({
        full_name: profileData.full_name || "",
        email: user.email || "",
        phone: profileData.phone || "",
        avatar_url: profileData.avatar_url || "",
        created_at: profileData.created_at,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: error.message,
      });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(getMessages(commonMessages).notAuthenticated);

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
          avatar_url: profile.avatar_url,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: getMessages(commonMessages).success,
        description: getMessages(settingsMessages).profile.saved,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: getMessages(settingsMessages).profile.notImage,
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: getMessages(settingsMessages).profile.tooLarge,
      });
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(getMessages(commonMessages).notAuthenticated);

      const fileExt = file.name.split(".").pop();
      const fileName = `avatar-${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("practice-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("practice-documents")
        .getPublicUrl(filePath);

      setProfile({ ...profile, avatar_url: publicUrl });

      // Auto-save avatar
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      toast({
        title: getMessages(commonMessages).success,
        description: getMessages(settingsMessages).profile.avatarSaved,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <User className="h-5 w-5" />
        <h2 className="text-xl font-semibold">{m.title}</h2>
      </div>

      <div className="space-y-6">
        {/* Avatar Section */}
        <div className="flex items-center gap-6">
          <div className="relative">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="h-24 w-24 rounded-full object-cover border-2 border-border"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                <User className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
            <button
              onClick={() => document.getElementById("avatar-upload")?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </button>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <div>
            <h3 className="font-semibold">{m.photo}</h3>
            <p className="text-sm text-muted-foreground">{m.photoHint}</p>
            {profile.avatar_url && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-destructive hover:text-destructive"
                onClick={() => setProfile({ ...profile, avatar_url: "" })}
              >
                {m.removePhoto}
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">{m.fullName}</Label>
            <Input
              id="full_name"
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              placeholder={m.fullNamePlaceholder}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{m.email}</Label>
            <Input
              id="email"
              value={profile.email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              {m.emailLocked}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone">{m.phone}</Label>
            <Input
              id="phone"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              placeholder="+39 333 1234567"
            />
          </div>

          <div className="space-y-2">
            <Label>{m.memberSince}</Label>
            <Input
              value={formatDate(profile.created_at, { day: "numeric", month: "long", year: "numeric" })}
              disabled
              className="bg-muted"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {m.save}
          </Button>
        </div>
      </div>
    </Card>
  );
};
