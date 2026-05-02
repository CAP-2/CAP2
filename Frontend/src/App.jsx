import AppRoutes from "./routes";
import AIChatGateway from "./components/AIChat/AIChatGateway";
import "./App.css";

export default function App() {
  return (
    <>
      <AppRoutes />
      <AIChatGateway />
    </>
  );
}
