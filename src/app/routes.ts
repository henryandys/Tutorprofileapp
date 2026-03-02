import { createBrowserRouter } from "react-router";
import { Home } from "./pages/Home";
import { Search } from "./pages/Search";
import { TutorProfile } from "./pages/TutorProfile";
import { CreateProfile } from "./pages/CreateProfile";
import { UserProfile } from "./pages/UserProfile";
import { Repository } from "./pages/Repository";
import { Login } from "./pages/Login";
import { TutorMyProfile } from "./pages/TutorMyProfile";

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
    path: "/become-a-tutor",
    Component: CreateProfile,
  },
  {
    path: "/profile",
    Component: UserProfile,
  },
  {
    path: "/my-profile",
    Component: TutorMyProfile,
  },
  {
    path: "/repository",
    Component: Repository,
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "*",
    Component: Home, // Fallback
  },
]);