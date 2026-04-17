import { createBrowserRouter } from "react-router";
import { Home } from "./pages/Home";
import { Search } from "./pages/Search";
import { TutorProfile } from "./pages/TutorProfile";
import { CreateProfile } from "./pages/CreateProfile";
import { UserProfile } from "./pages/UserProfile";
import { Repository } from "./pages/Repository";
import Login from "./pages/Login";
import { TutorMyProfile } from "./pages/TutorMyProfile";
import { ProtectedRoute } from "./components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/search",
    Component: Search,
  },
  {
    path: "/tutor/:id",
    Component: TutorProfile,
  },
  {
    path: "/login",
    Component: Login,
  },

  // ── Requires any logged-in user ──────────────────────────
  {
    path: "/profile",
    element: (
      <ProtectedRoute>
        <UserProfile />
      </ProtectedRoute>
    ),
  },
  {
    path: "/repository",
    element: (
      <ProtectedRoute>
        <Repository />
      </ProtectedRoute>
    ),
  },

  // ── Requires tutor role ──────────────────────────────────
  {
    path: "/become-a-tutor",
    element: (
      <ProtectedRoute requiredRole="tutor">
        <CreateProfile />
      </ProtectedRoute>
    ),
  },
  {
    path: "/my-profile",
    element: (
      <ProtectedRoute requiredRole="tutor">
        <TutorMyProfile />
      </ProtectedRoute>
    ),
  },

  {
    path: "*",
    Component: Home,
  },
]);