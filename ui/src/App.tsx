import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ThemeProvider } from "@/components/theme-provider";
import { LoginForm } from '@/components/login-form';
import { Navbar } from '@/components/navbar';
import { AppSidebar } from '@/components/appSidebar';
import { Home } from '@/pages/Home';
import { Settings } from '@/pages/Settings';
import { Onboarding } from '@/pages/Onboarding';
import { Dashboard } from '@/pages/Dashboard';
import { Analytics } from '@/pages/Analytics';
import { Support } from '@/pages/Support';
import { AIControlPanel } from '@/pages/AIControlPanel';
import { Reports } from '@/pages/Reports';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { useMT5Connection } from '@/hooks/useMT5Connection';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function AppContent() {
  const { user, loading, profileLoading } = useAuth();
  const [showLoginForAnonymous, setShowLoginForAnonymous] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { accounts, refreshAccounts } = useMT5Connection();

  // Determine if login form should be shown (memoized to prevent unnecessary re-renders)
  const shouldShowLogin = useMemo(() => {
    const allowAnonymous = import.meta.env.VITE_ALLOW_ANONYMOUS_USERS !== 'false';
    return allowAnonymous
      ? !user || (user.isAnonymous && showLoginForAnonymous)
      : !user || user.isAnonymous;
  }, [user, showLoginForAnonymous]);

  // Debug logging
  useEffect(() => {
    console.log('AppContent render:', { 
      hasUser: !!user, 
      isAnonymous: user?.isAnonymous, 
      loading, 
      profileLoading,
      pathname: location.pathname 
    });
  }, [user, loading, profileLoading, location.pathname]);

  // Reset login form state when user upgrades from anonymous to authenticated
  useEffect(() => {
    if (user && !user.isAnonymous) {
      setShowLoginForAnonymous(false);
    }
  }, [user?.isAnonymous]);

  // Removed automatic redirect from home page to dashboard
  // Users can now stay on the home page and navigate manually

  // Show loading while authentication or profile is loading
  // This early return must come AFTER all hooks are called
  if (loading || profileLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  const handleSignInClick = () => {
    setShowLoginForAnonymous(true);
  };

  return (
    <SidebarProvider>
      <div className="flex flex-col w-full min-h-screen bg-background">
        <Navbar onSignInClick={handleSignInClick} />
        {shouldShowLogin ? (
          <main className="flex flex-col items-center justify-center flex-1 p-4">
            <LoginForm />
          </main>
        ) : (
          <div className="flex flex-1">
            <AppSidebar />
            <SidebarInset className="flex-1">
              <main className="flex-1">
                <Routes>
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/ai-control" element={<AIControlPanel />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/" element={<Home />} />
                </Routes>
              </main>
            </SidebarInset>
          </div>
        )}
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider 
          attribute="class" 
          defaultTheme="system" 
          enableSystem
          disableTransitionOnChange
          storageKey="volo-app-theme"
        >
          <Router>
            <AppContent />
          </Router>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
