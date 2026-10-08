import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useMessages } from "@/i18n";
import { shellMessages } from "@/i18n/messages/shell";

const NotFound = () => {
  const location = useLocation();
  const m = useMessages(shellMessages).notFound;

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">{m.text}</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          {m.home}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
