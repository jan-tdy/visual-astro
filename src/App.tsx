import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { SubscriptionProvider } from "@/hooks/useSubscription";
import { ThemeProvider } from "@/hooks/useTheme";
import { I18nProvider } from "@/hooks/useI18n";
import { AppModeProvider } from "@/hooks/useAppMode";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import Auth from "./pages/Auth.tsx";
import Sessions from "./pages/Sessions.tsx";
import SessionEditor from "./pages/SessionEditor.tsx";
import Catalog from "./pages/Catalog.tsx";
import Prom from "./pages/Prom.tsx";
import PozorLayout from "./pages/pozor/PozorLayout.tsx";
import PozorChartPage from "./pages/pozor/ChartPage.tsx";
import PozorJournalPage from "./pages/pozor/JournalPage.tsx";
import PozorMinimaPage from "./pages/pozor/MinimaPage.tsx";
import PozorInstantPage from "./pages/pozor/InstantPage.tsx";
import PozorCatalogPage from "./pages/pozor/CatalogPage.tsx";
import Graphs from "./pages/Graphs.tsx";
import Settings from "./pages/Settings.tsx";
import Tools from "./pages/Tools.tsx";
import About from "./pages/About.tsx";
import OAuthConsent from "./pages/OAuthConsent.tsx";
import CheckoutReturn from "./pages/CheckoutReturn.tsx";
import NotFound from "./pages/NotFound.tsx";
import { ProtectedRoute } from "./components/app/ProtectedRoute.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <I18nProvider>
    <AppModeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <SubscriptionProvider>
          <ErrorBoundary>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Sessions /></ProtectedRoute>} />
            <Route path="/session/:id" element={<ProtectedRoute><SessionEditor /></ProtectedRoute>} />
            <Route path="/catalog" element={<ProtectedRoute><Catalog /></ProtectedRoute>} />
            <Route path="/prom" element={<ProtectedRoute><Prom /></ProtectedRoute>} />
            <Route path="/pozor" element={<ProtectedRoute><PozorLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="chart" replace />} />
              <Route path="chart" element={<PozorChartPage />} />
              <Route path="journal" element={<PozorJournalPage />} />
              <Route path="minima" element={<PozorMinimaPage />} />
              <Route path="instant" element={<PozorInstantPage />} />
              <Route path="catalog" element={<PozorCatalogPage />} />
            </Route>
            <Route path="/graphs" element={<ProtectedRoute><Graphs /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/tools" element={<ProtectedRoute><Tools /></ProtectedRoute>} />
            <Route path="/checkout/return" element={<ProtectedRoute><CheckoutReturn /></ProtectedRoute>} />
            <Route path="/about" element={<About />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ErrorBoundary>
          </SubscriptionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </AppModeProvider>
    </I18nProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
