import { BrowserRouter as Router, Routes, Route, Outlet } from "react-router-dom";
import { lazy, Suspense } from "react";

import { PublicOnly } from "./routes/PublicOnly";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { RegistrationRoute } from "./routes/RegistrationRoute";
import { AuthProvider } from "@/context/AuthProvider";

import ScrollToTop from '@/components/ScrollToTop'

// --- Import Lazy dei Componenti ---
const Tool = lazy(() => import("./pages/Tool").then(m => ({ default: m.Tool })));
const Login = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const Register = lazy(() => import("./pages/Register").then(m => ({ default: m.Register })));
const Profile = lazy(() => import("./pages/Profile").then(m => ({ default: m.Profile })));
const EditProfile = lazy(() => import("./pages/EditProfile").then(m => ({ default: m.EditProfile })));
const Plans = lazy(() => import("./pages/Plans").then(m => ({ default: m.Plans })));
const Admin = lazy(() => import("./pages/Admin").then(m => ({ default: m.Admin })));

const Prezzi = lazy(() => import("./pages/Prezzi"));
const Contatti = lazy(() => import("./pages/Contatti"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Session = lazy(() => import("./pages/Session"));
const Chat = lazy(() => import("./pages/Chat"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const TeamDashboard = lazy(() => import("./pages/TeamDashboard"));
const FascicoloSetupPage = lazy(() => import("./components/Chat/FascicoloSetupPage"));
const PromptBuilder = lazy(() => import("./pages/PromptBuilder"));
const SupportoWord = lazy(() => import("./pages/SupportoWord"));
const UserUsage = lazy(() => import("./pages/UserUsage"));

const BillingSuccess = lazy(() => import("./pages/BillingSuccess"));
const BillingCancel = lazy(() => import("./pages/BillingCancel"));

const Guida = lazy(() => import("./pages/Guida"));
const Notification = lazy(() => import("./pages/NotificationsPage"));

// ============================================================
// LAYOUT
// ============================================================

const RootLayout = () => (
  <>
    <Outlet />
  </>
);

// ============================================================
// APP
// ============================================================

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Suspense fallback={null}>
          <ScrollToTop />
          <Routes>
            <Route element={<RootLayout />}>

              {/* ==================================================
                  ROTTE PUBBLICHE
              ================================================== */}
              <Route path="/" element={<Tool/>} />
              <Route path="/prezzi" element={<Prezzi/>} />
              <Route path="/contatti" element={<Contatti />} />
              <Route path="/sessione-attiva" element={<Session />} />
              <Route path="/supporto-word" element={<SupportoWord />} />
              <Route path="/guida" element={<Guida />} />
              <Route path="/guida/:slug" element={<Guida />} />
              <Route path="/billing/cancel" element={<BillingCancel />} />

              {/* ==================================================
                  AUTH GUEST ONLY
              ================================================== */}
              <Route
                path="/login"
                element={
                  <PublicOnly>
                    <Login />
                  </PublicOnly>
                }
              />
              <Route
                path="/registrati"
                element={
                  <RegistrationRoute>
                    <Register />
                  </RegistrationRoute>
                }
              />

              {/* ==================================================
                  ROTTE MISTE / APP TOOL
              ================================================== */}
              <Route path="/ricerca" element={<Tool />} />
              <Route path="/giurisprudenza/:id" element={<Tool />} />
              <Route path="/documento/:id" element={<Tool />} />
              <Route path="/chat" element={<Chat />} />

              {/* ==================================================
                  ROTTE PROTETTE
              ================================================== */}
              <Route
                path="/profilo"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profilo/modifica"
                element={
                  <ProtectedRoute>
                    <EditProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profilo/piani"
                element={
                  <ProtectedRoute>
                    <Plans />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profilo/team"
                element={
                  <ProtectedRoute>
                    <TeamDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profilo/utilizzi"
                element={
                  <ProtectedRoute>
                    <UserUsage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profilo/prompt-builder"
                element={
                  <ProtectedRoute>
                    <PromptBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifiche"
                element={
                  <ProtectedRoute>
                    <Notification />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/billing/success"
                element={
                  <ProtectedRoute>
                    <BillingSuccess />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat/:chatId"
                element={
                  <ProtectedRoute>
                    <Chat />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/fascicolo/:fascicoloId/:threadId?"
                element={
                  <ProtectedRoute>
                    <Chat />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/crea-nuovo-fascicolo"
                element={
                  <ProtectedRoute>
                    <FascicoloSetupPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/storico"
                element={
                  <ProtectedRoute>
                    <HistoryPage />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </Router>
  );
}