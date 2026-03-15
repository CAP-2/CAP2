import React from "react";
import { RouterProvider } from "react-router";
import { ModeProvider } from "./components/ModeContext";
import { AuthProvider } from "./components/AuthContext";
import { router } from "./routes.tsx";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  return (
    <ModeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster 
          position="top-center"
          richColors
          expand={false}
        />
      </AuthProvider>
    </ModeProvider>
  );
}