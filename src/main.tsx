import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./ThemeContext";
import { DisasterProvider } from "./DisasterContext";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <DisasterProvider>
      <App />
    </DisasterProvider>
  </ThemeProvider>
);
