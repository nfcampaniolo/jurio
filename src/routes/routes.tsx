import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

import { PublicOnly } from "./PublicOnly";
import { ProtectedRoute } from "./ProtectedRoute";
import { RegistrationRoute } from "./RegistrationRoute";

// ============================================================
// LAZY IMPORT
// ============================================================

const Tool = lazy(() =>
  import("@/features/search/Tool").then((m) => ({
    default: m.Tool,
  }))
);

const Documento = lazy(() =>
  import("@/features/document/Documento").then((m) => ({
    default: m.Documento,
  }))
);

const Login = lazy(() =>
  import("@/features/auth/Login").then((m) => ({
    default: m.Login,
  }))
);

const Register = lazy(() =>
  import("@/features/auth/Register").then((m) => ({
    default: m.Register,
  }))
);

const Profile = lazy(() =>
  import("@/features/profile/Profile").then((m) => ({
    default: m.Profile,
  }))
);

const EditProfile = lazy(() =>
  import("@/features/profile/EditProfile").then((m) => ({
    default: m.EditProfile,
  }))
);

const Plans = lazy(() =>
  import("@/features/plans/Plans").then((m) => ({
    default: m.Plans,
  }))
);

const Admin = lazy(() =>
  import("@/features/admin/Admin").then((m) => ({
    default: m.Admin,
  }))
);

const Prezzi = lazy(() => import("@/features/plans/Prezzi"));
const Contatti = lazy(() => import("@/features/info/Contatti"));
const NotFound = lazy(() => import("@/shared/NotFound"));
const Session = lazy(() => import("@/features/auth/Session"));
const Chat = lazy(() => import("@/features/chat/Chat"));
const HistoryPage = lazy(() => import("@/features/chat/components/HistoryPage"));
const TeamDashboard = lazy(() => import("@/features/teams/TeamDashboard"));

const FascicoloSetupPage = lazy(
  () => import("@/features/chat/components/FascicoloSetupPage")
);

const PromptBuilder = lazy(() => import("@/features/prompt/PromptBuilder"));
const SupportoWord = lazy(() => import("@/features/guide/components/SupportoWord"));
const UserUsage = lazy(() => import("@/features/profile/UserUsage"));

const BillingSuccess = lazy(() => import("@/features/plans/BillingSuccess"));
const BillingCancel = lazy(() => import("@/features/plans/BillingCancel"));

const Guida = lazy(() => import("@/features/guide/Guida"));
const Notification = lazy(() => import("@/features/notifications/NotificationsPage"));

// ============================================================
// ROUTES
// ============================================================

export const appRoutes: RouteObject[] = [
  // ==========================================================
  // ROTTE PUBBLICHE
  // ==========================================================

  {
    path: "/",
    element: <Tool />,
  },

  {
    path: "/prezzi",
    element: <Prezzi />,
  },

  {
    path: "/contatti",
    element: <Contatti />,
  },

  {
    path: "/sessione-attiva",
    element: <Session />,
  },

  {
    path: "/supporto-word",
    element: <SupportoWord />,
  },

  {
    path: "/guida",
    element: <Guida />,
  },

  {
    path: "/guida/:slug",
    element: <Guida />,
  },

  {
    path: "/billing/cancel",
    element: <BillingCancel />,
  },

  // ==========================================================
  // AUTH - GUEST ONLY
  // ==========================================================

  {
    path: "/login",
    element: (
      <PublicOnly>
        <Login />
      </PublicOnly>
    ),
  },

  {
    path: "/registrati",
    element: (
      <RegistrationRoute>
        <Register />
      </RegistrationRoute>
    ),
  },

  // ==========================================================
  // ROTTE MISTE / APP TOOL
  // ==========================================================

  {
    path: "/ricerca",
    element: <Tool />,
  },

  {
    path: "/giurisprudenza/:id",
    element: <Documento />,
  },

  {
    path: "/documento/:id",
    element: <Documento />,
  },

  {
    path: "/chat",
    element: <Chat />,
  },

  // ==========================================================
  // ROTTE PROTETTE
  // ==========================================================

  {
    path: "/profilo",
    element: (
      <ProtectedRoute>
        <Profile />
      </ProtectedRoute>
    ),
  },

  {
    path: "/profilo/modifica",
    element: (
      <ProtectedRoute>
        <EditProfile />
      </ProtectedRoute>
    ),
  },

  {
    path: "/profilo/piani",
    element: (
      <ProtectedRoute>
        <Plans />
      </ProtectedRoute>
    ),
  },

  {
    path: "/profilo/team",
    element: (
      <ProtectedRoute>
        <TeamDashboard />
      </ProtectedRoute>
    ),
  },

  {
    path: "/profilo/utilizzi",
    element: (
      <ProtectedRoute>
        <UserUsage />
      </ProtectedRoute>
    ),
  },

  {
    path: "/profilo/prompt-builder",
    element: (
      <ProtectedRoute>
        <PromptBuilder />
      </ProtectedRoute>
    ),
  },

  {
    path: "/admin",
    element: (
      <ProtectedRoute>
        <Admin />
      </ProtectedRoute>
    ),
  },

  {
    path: "/notifiche",
    element: (
      <ProtectedRoute>
        <Notification />
      </ProtectedRoute>
    ),
  },

  {
    path: "/billing/success",
    element: (
      <ProtectedRoute>
        <BillingSuccess />
      </ProtectedRoute>
    ),
  },

  {
    path: "/chat/:chatId",
    element: (
      <ProtectedRoute>
        <Chat />
      </ProtectedRoute>
    ),
  },

  {
    path: "/fascicolo/:fascicoloId/:threadId?",
    element: (
      <ProtectedRoute>
        <Chat />
      </ProtectedRoute>
    ),
  },

  {
    path: "/crea-nuovo-fascicolo",
    element: (
      <ProtectedRoute>
        <FascicoloSetupPage />
      </ProtectedRoute>
    ),
  },

  {
    path: "/storico",
    element: (
      <ProtectedRoute>
        <HistoryPage />
      </ProtectedRoute>
    ),
  },

  // ==========================================================
  // FALLBACK
  // ==========================================================

  {
    path: "*",
    element: <NotFound />,
  },
];