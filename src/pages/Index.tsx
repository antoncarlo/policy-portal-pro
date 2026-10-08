import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Shield, Upload, Users, Clock, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoginDialog } from "@/components/LoginDialog";
import type { User } from "@supabase/supabase-js";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useMessages } from "@/i18n";
import { shellMessages } from "@/i18n/messages/shell";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const { landing: m, nav } = useMessages(shellMessages);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const featureIcons = [Upload, Clock, Shield, Users, FileText, CheckCircle];
  const statValues = ["10,000+", "500+", "99.9%", "24/7"];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center">
            <img src="/logo.svg" alt="Tecno Advance MGA" className="h-12" />
          </div>
          <nav className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
            <LanguageSwitcher variant="compact" />
            {user ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost">{nav.dashboard}</Button>
                </Link>
                <Link to="/dashboard">
                  <Button>{m.goToPortal}</Button>
                </Link>
              </>
            ) : (
              <Button onClick={() => setLoginOpen(true)}>{m.signIn}</Button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 text-foreground">
            {m.heroTitle}
            <span className="block text-primary mt-2">{m.heroAccent}</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {m.heroText}
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            {user ? (
              <>
                <Link to="/upload">
                  <Button size="lg" className="text-lg px-8">
                    <Upload className="mr-2 h-5 w-5" />
                    {m.uploadPractice}
                  </Button>
                </Link>
                <Link to="/dashboard">
                  <Button size="lg" variant="outline" className="text-lg px-8">
                    <FileText className="mr-2 h-5 w-5" />
                    {m.viewDashboard}
                  </Button>
                </Link>
              </>
            ) : (
              <Button 
                size="lg" 
                className="text-lg px-8"
                onClick={() => setLoginOpen(true)}
              >
                {m.signInPortal}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-card">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
            {m.featuresTitle}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {m.features.map((feature, index) => {
              const Icon = featureIcons[index];
              return (
                <div key={feature.title} className="p-6 rounded-lg bg-background border border-border hover:shadow-lg transition-shadow">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            {m.stats.map((label, index) => (
              <div key={label}>
                <div className="text-4xl font-bold text-primary mb-2">{statValues[index]}</div>
                <div className="text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 bg-card">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>© 2024 Tecno Advance MGA Broker SRL. {m.rights}</p>
        </div>
      </footer>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
};

export default Index;
