
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { Analytics } from "@vercel/analytics/react";

  createRoot(document.getElementById("root")!).render(
    <>
      <App />
      <Analytics />
    </>
  );
  