import React, { createContext, useContext, useState, ReactNode } from "react";

export type AppMode = "elderly" | "young";

interface ModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  isElderly: boolean;
}

const ModeContext = createContext<ModeContextType>({
  mode: "young",
  setMode: () => {},
  isElderly: false,
});

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AppMode>("young");

  return (
    <ModeContext.Provider value={{ mode, setMode, isElderly: mode === "elderly" }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  return useContext(ModeContext);
}
