import { BrowserRouter as Router, useRoutes } from "react-router-dom";
import { Suspense } from "react";

import { appRoutes } from "@/routes/routes";
import ScrollToTop from "@/shared/components/ScrollToTop";
import { AuthLoader } from "@/routes/AuthLoader";

function AppRouter() {
  return useRoutes(appRoutes);
}

export default function App() {
  return (
    <Router>
      <Suspense fallback={<AuthLoader />}>
        <ScrollToTop />
        <AppRouter />
      </Suspense>
    </Router>
  );
}