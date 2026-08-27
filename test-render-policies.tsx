import React from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route } from "./src/routes/admin/_shell/policies";

const queryClient = new QueryClient();

// mock useSession
jest.mock("./src/lib/session", () => ({
  useSession: () => ({ user: { id: "123" } }),
}));

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Route.options.component />
    </QueryClientProvider>
  );
};

try {
  const html = renderToString(<App />);
  console.log("Success!");
} catch (err) {
  console.error("Failed to render:", err);
}
