import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
import "./index.css";

const App = lazy(() => import("./App"));

createRoot(document.getElementById("root")!).render(
  <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-sm text-cyan-300">사이트를 불러오는 중입니다...</div>}>
    <App />
  </Suspense>,
);
