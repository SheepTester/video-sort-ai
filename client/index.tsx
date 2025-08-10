import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Wrapper } from "./Wrapper";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Wrapper />
  </StrictMode>
);
