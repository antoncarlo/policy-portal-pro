import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Shield, Upload, Users, Clock, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoginDialog } from "@/components/LoginDialog";
import type { User } from "@supabase/supabase-js";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/logo.svg" alt="Tecno Advance MGA" className="h-12" />
          </div>
          <nav className="flex items-center gap-4">
            {user ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost">Dashboard</Button>
                </Link>
                <Link to="/dashboard">
                  <Button>Vai al Portale</Button>
                </Link>
              </>
            ) : (
              <Button onClick={() => setLoginOpen(true)}>Accedi</Button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 text-foreground">
            Gestione Pratiche Assicurative
            <span className="block text-primary mt-2">Semplice e Professionale</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Carica, gestisci e monitora tutte le tue pratiche assicurative in un unico portale sicuro e intuitivo
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            {user ? (
              <>
                <Link to="/upload">
                  <Button size="lg" className="text-lg px-8">
                    <Upload className="mr-2 h-5 w-5" />
                    Carica Pratica
                  </Button>
                </Link>
                <Link to="/dashboard">
                  <Button size="lg" variant="outline" className="text-lg px-8">
                    <FileText className="mr-2 h-5 w-5" />
                    Visualizza Dashboard
                  </Button>
                </Link>
              </>
            ) : (
              <Button 
                size="lg" 
                className="text-lg px-8"
                onClick={() => setLoginOpen(true)}
              >
                Accedi al Portale
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-card">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
            Funzionalità Principali
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-lg bg-background border border-border hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Caricamento Rapido</h3>
              <p className="text-muted-foreground">
                Carica documenti e pratiche in pochi click con drag & drop e supporto multi-file
              </p>
            </div>

            <div className="p-6 rounded-lg bg-background border border-border hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Monitoraggio Real-time</h3>
              <p className="text-muted-foreground">
                Traccia lo stato di ogni pratica in tempo reale con notifiche automatiche
              </p>
            </div>

            <div className="p-6 rounded-lg bg-background border border-border hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Sicurezza Garantita</h3>
              <p className="text-muted-foreground">
                Dati crittografati e conformità GDPR per la massima protezione delle informazioni
              </p>
            </div>

            <div className="p-6 rounded-lg bg-background border border-border hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Gestione Clienti</h3>
              <p className="text-muted-foreground">
                Organizza e gestisci tutti i dati dei tuoi clienti in modo efficiente
              </p>
            </div>

            <div className="p-6 rounded-lg bg-background border border-border hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Archivio Digitale</h3>
              <p className="text-muted-foreground">
                Accedi a tutte le pratiche storiche con ricerca avanzata e filtri intelligenti
              </p>
            </div>

            <div className="p-6 rounded-lg bg-background border border-border hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Workflow Automatici</h3>
              <p className="text-muted-foreground">
                Automatizza le operazioni ripetitive e velocizza l'elaborazione delle pratiche
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">10,000+</div>
              <div className="text-muted-foreground">Pratiche Gestite</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">500+</div>
              <div className="text-muted-foreground">Agenti Attivi</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">99.9%</div>
              <div className="text-muted-foreground">Uptime Garantito</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">24/7</div>
              <div className="text-muted-foreground">Supporto Disponibile</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 bg-card">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>© 2024 Tecno Advance MGA Broker SRL. Tutti i diritti riservati.</p>
        </div>
      </footer>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
};

export default Index;
