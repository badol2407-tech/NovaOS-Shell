import { useEffect, useRef } from 'react';
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from 'next-themes';
import LandingPage from '@/pages/LandingPage';
import Desktop from '@/pages/Desktop';

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
  },
  variables: {
    colorPrimary: 'hsl(221 83% 53%)',
    colorForeground: 'hsl(222 47% 11%)',
    colorMutedForeground: 'hsl(215.4 16.3% 46.9%)',
    colorDanger: 'hsl(0 84.2% 60.2%)',
    colorBackground: 'hsl(0 0% 100%)',
    colorInput: 'hsl(214.3 31.8% 91.4%)',
    colorInputForeground: 'hsl(222 47% 11%)',
    colorNeutral: 'hsl(214.3 31.8% 91.4%)',
    fontFamily: 'Outfit, sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox:
      'bg-white dark:bg-zinc-950 rounded-2xl w-[440px] max-w-full overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none bg-zinc-50 dark:bg-zinc-900',
    headerTitle: 'text-2xl font-bold tracking-tight',
    headerSubtitle: 'text-zinc-500',
    socialButtonsBlockButtonText: 'font-medium text-zinc-700 dark:text-zinc-300',
    formFieldLabel: 'text-sm font-medium',
    footerActionLink: 'font-semibold text-primary hover:text-primary/80',
    footerActionText: 'text-zinc-500',
    dividerText: 'text-xs font-medium text-zinc-500',
    formButtonPrimary:
      'bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg shadow-sm transition-colors',
    formFieldInput:
      'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  },
};

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/desktop" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function DesktopRoute() {
  return (
    <>
      <Show when="signed-in">
        <Desktop />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-accent/10" />
      <div className="z-10 relative">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-accent/10" />
      <div className="z-10 relative">
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/desktop" component={DesktopRoute} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route
            component={() => (
              <div className="min-h-screen flex items-center justify-center">
                <h1 className="text-xl font-bold">404 Not Found</h1>
              </div>
            )}
          />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <ClerkProviderWithRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
