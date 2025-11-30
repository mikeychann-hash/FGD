import { BrowserRouter, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Fusion from "./pages/Fusion";
import { AppShell } from "./components/layout/AppShell";
import { Toaster } from "./components/ui/toaster";

function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/fusion" element={<Fusion />} />
        </Routes>
      </AppShell>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
