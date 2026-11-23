import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpLink, splitLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Query Error]", event.query.state.error);
  }
});
queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

// Authentication is the HttpOnly session cookie only. No token is read from or
// written to localStorage/sessionStorage, so an XSS payload has nothing to
// steal and the server can revoke the session.
const sharedLinkOptions = {
  url: "/api/trpc",
  transformer: superjson,
  fetch(input: RequestInfo | URL, init?: RequestInit) {
    return globalThis.fetch(input, {
      ...(init ?? {}),
      credentials: "include" as const,
    });
  },
};

const trpcClient = trpc.createClient({
  links: [
    splitLink({
      // Uploads are sent on their own request (never batched with other calls)
      // so the server can authenticate and rate-limit that exact URL before it
      // parses the large body.
      condition: op => op.path === "admin.media.upload",
      true: httpLink(sharedLinkOptions),
      false: httpBatchLink(sharedLinkOptions),
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
