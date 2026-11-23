import { lazy, Suspense, useEffect } from "react";
import { Route, Switch, useLocation, useParams } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./contexts/I18nContext";
import { PublicLayout } from "./components/site/PublicLayout";
import Home from "./pages/Home";
import Article from "./pages/Article";
import { NotFound } from "./pages/NotFound";
import AdminLogin from "./pages/admin/AdminLogin";
import { DEFAULT_LOCALE, isLocale } from "@shared/news";

const AdminLayout = lazy(() =>
  import("./components/admin/AdminLayout").then(module => ({ default: module.AdminLayout }))
);
const Category = lazy(() => import("./pages/Category"));
const Search = lazy(() => import("./pages/Search"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const TipLine = lazy(() => import("./pages/TipLine"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const EditorialPolicy = lazy(() => import("./pages/EditorialPolicy"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Articles = lazy(() => import("./pages/admin/Articles"));
const ArticleEditor = lazy(() => import("./pages/admin/ArticleEditor"));
const Audit = lazy(() => import("./pages/admin/Audit"));
const Media = lazy(() => import("./pages/admin/Media"));
const Messages = lazy(() => import("./pages/admin/Messages"));
const Subscribers = lazy(() => import("./pages/admin/Subscribers"));
const Settings = lazy(() => import("./pages/admin/Settings"));

function Public({ children }: { children: React.ReactNode }) {
  return <PublicLayout>{children}</PublicLayout>;
}

function Admin({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}

function Locale({ children }: { children: React.ReactNode }) {
  const params = useParams<{ locale?: string }>();
  if (!params.locale || !isLocale(params.locale)) {
    return (
      <Public>
        <NotFound />
      </Public>
    );
  }
  return <Public>{children}</Public>;
}

function RouteFallback() {
  return (
    <div className="container-news py-16" aria-busy="true" aria-label="Loading page">
      <div className="skeleton h-5 w-36 rounded" />
      <div className="skeleton mt-4 h-12 w-3/4 rounded" />
      <div className="skeleton mt-8 h-72 w-full rounded-lg" />
    </div>
  );
}

function LocaleHomeRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(`/${DEFAULT_LOCALE}/`, { replace: true });
  }, [setLocation]);
  return <RouteFallback />;
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={LocaleHomeRedirect} />

        <Route path="/admin" component={AdminLogin} />
        <Route path="/:locale/admin" component={AdminLogin} />
        <Route path="/admin/dashboard" component={() => <Admin><Dashboard /></Admin>} />
        <Route path="/admin/articles" component={() => <Admin><Articles /></Admin>} />
        <Route path="/admin/articles/new" component={() => <Admin><Articles /></Admin>} />
        <Route path="/admin/articles/:id" component={() => <Admin><ArticleEditor /></Admin>} />
        <Route path="/admin/audit" component={() => <Admin><Audit /></Admin>} />
        <Route path="/admin/media" component={() => <Admin><Media /></Admin>} />
        <Route path="/admin/messages" component={() => <Admin><Messages /></Admin>} />
        <Route path="/admin/subscribers" component={() => <Admin><Subscribers /></Admin>} />
        <Route path="/admin/settings" component={() => <Admin><Settings /></Admin>} />

        <Route path="/:locale" component={() => <Locale><Home /></Locale>} />
        <Route path="/:locale/article/:slug" component={() => <Locale><Article /></Locale>} />
        <Route path="/:locale/category/:key" component={() => <Locale><Category /></Locale>} />
        <Route path="/:locale/search" component={() => <Locale><Search /></Locale>} />
        <Route path="/:locale/about" component={() => <Locale><About /></Locale>} />
        <Route path="/:locale/contact" component={() => <Locale><Contact /></Locale>} />
        <Route path="/:locale/tip-line" component={() => <Locale><TipLine /></Locale>} />
        <Route path="/:locale/privacy" component={() => <Locale><Privacy /></Locale>} />
        <Route path="/:locale/terms" component={() => <Locale><Terms /></Locale>} />
        <Route
          path="/:locale/editorial-policy"
          component={() => <Locale><EditorialPolicy /></Locale>}
        />

        <Route path="/404" component={() => <Public><NotFound /></Public>} />
        <Route component={() => <Public><NotFound /></Public>} />
      </Switch>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <I18nProvider>
          <TooltipProvider>
            <Toaster position="top-center" />
            <Router />
          </TooltipProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
