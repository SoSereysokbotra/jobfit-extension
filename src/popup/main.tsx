import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/tokens.css";
import "./popup.css";
import { App } from "./App";

const container = document.getElementById("root");
if (!container) throw new Error("Popup root element #root not found");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
