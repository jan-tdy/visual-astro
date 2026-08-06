import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useI18n } from "@/hooks/useI18n";
import { lovable } from "@/integrations/lovable/index";

export default function Auth() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const [params] = useSearchParams();
  const rawNext = params.get("next") ?? "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (next) {
      window.location.href = next;
      return;
    }
    navigate("/", { replace: true });
  }, [user, navigate, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${next || "/"}` },
        });
        if (error) throw error;
        toast.success(t("auth.created"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message ?? t("auth.error"));
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setGoogleBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? t("auth.error"));
        return;
      }
      if (result.redirected) return;
    } catch (err: any) {
      toast.error(err?.message ?? t("auth.error"));
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6 space-y-5">
        <div className="flex justify-end">
          <button
            onClick={() => setLang(lang === "sk" ? "en" : "sk")}
            className="text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {lang === "sk" ? "SK" : "EN"}
          </button>
        </div>
        <div className="text-center">
          <div className="text-3xl mb-1 text-primary">✦</div>
          <h1 className="text-xl font-semibold">{t("auth.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("auth.subtitle")}</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="pw">{t("auth.password")}</Label>
            <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "signin" ? t("auth.signin") : t("auth.signup")}
          </Button>
        </form>
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              {t("auth.or") === "auth.or" ? "or" : t("auth.or")}
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={googleBusy}
          onClick={signInWithGoogle}
        >
          <svg className="h-4 w-4 mr-2" viewBox="0 0 48 48" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.8 2.6 13.6l7.8 6.1C12.3 13.7 17.6 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.15-3.2-.44-4.6H24v9h12.6c-.55 2.9-2.2 5.4-4.6 7.1l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.4z"/>
            <path fill="#FBBC05" d="M10.4 28.3c-.5-1.5-.8-3-.8-4.8s.3-3.3.8-4.8l-7.8-6.1C1 15.9 0 19.8 0 23.5s1 7.6 2.6 10.9l7.8-6.1z"/>
            <path fill="#34A853" d="M24 47.5c6.2 0 11.5-2 15.5-5.6l-7.6-5.9c-2.1 1.4-4.8 2.3-7.9 2.3-6.4 0-11.7-4.2-13.6-10.2l-7.8 6.1C6.5 42.2 14.6 47.5 24 47.5z"/>
          </svg>
          {t("auth.google") === "auth.google" ? "Continue with Google" : t("auth.google")}
        </Button>
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? t("auth.toSignup") : t("auth.toSignin")}
        </button>
        <Link
          to="/about"
          className="block text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {t("auth.about")}
        </Link>
      </Card>
    </div>
  );
}