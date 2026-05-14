import { createBrowserRouter } from "react-router";
import { Home } from "./pages/Home";
import { Search } from "./pages/Search";
import { TutorProfile } from "./pages/TutorProfile";
import { CreateProfile } from "./pages/CreateProfile";
import { UserProfile } from "./pages/UserProfile";
import { Repository } from "./pages/Repository";
import Login from "./pages/Login";
import { TutorMyProfile } from "./pages/TutorMyProfile";
import { TutorReviews } from "./pages/TutorReviews";
import { PrivacySecurity } from "./pages/PrivacySecurity";
import { ForTutors } from "./pages/ForTutors";
import { Lessons } from "./pages/Lessons";
import { RequestedTutors } from "./pages/RequestedTutors";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Admin } from "./pages/Admin"
import { StudentDashboard } from "./pages/StudentDashboard"
import { InstructorDashboard } from "./pages/InstructorDashboard"
import { GuardianDashboard } from "./pages/GuardianDashboard"
import { JoinFamily } from "./pages/JoinFamily"
import { StudentDetail } from "./pages/StudentDetail"
import { InstructorDetail } from "./pages/InstructorDetail"

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
    path: "/for-tutors",
    Component: ForTutors,
  },
  {
    path: "/needed-courses",
    Component: RequestedTutors,
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
  {
    path: "/privacy-security",
    element: (
      <ProtectedRoute>
        <PrivacySecurity />
      </ProtectedRoute>
    ),
  },
  {
    path: "/lessons",
    element: (
      <ProtectedRoute>
        <Lessons />
      </ProtectedRoute>
    ),
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <StudentDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/instructor-dashboard",
    element: (
      <ProtectedRoute>
        <InstructorDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/guardian-dashboard",
    element: (
      <ProtectedRoute>
        <GuardianDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/join-family/:token",
    Component: JoinFamily,
  },

  // ── Requires any logged-in user ─────────────────────────
  {
    path: "/become-a-tutor",
    element: (
      <ProtectedRoute>
        <CreateProfile />
      </ProtectedRoute>
    ),
  },

  // ── Requires student role ────────────────────────────────
  {
    path: "/my-instructors/:id",
    element: (
      <ProtectedRoute>
        <InstructorDetail />
      </ProtectedRoute>
    ),
  },

  // ── Requires tutor role ──────────────────────────────────
  {
    path: "/my-students/:id",
    element: (
      <ProtectedRoute requiredRole="tutor">
        <StudentDetail />
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
    path: "/my-reviews",
    element: (
      <ProtectedRoute requiredRole="tutor">
        <TutorReviews />
      </ProtectedRoute>
    ),
  },

  // ── Admin ────────────────────────────────────────────────────
  {
    path: "/admin",
    element: (
      <ProtectedRoute>
        <Admin />
      </ProtectedRoute>
    ),
  },

  {
    path: "*",
    Component: Home,
  },
]);