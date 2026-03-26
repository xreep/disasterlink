import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./ThemeContext";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
