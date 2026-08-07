import { OdontoProvider } from "@/store/OdontoStore";
import { Estacion } from "@/components/Estacion";

export function App() {
  return (
    <OdontoProvider>
      <Estacion />
    </OdontoProvider>
  );
}
