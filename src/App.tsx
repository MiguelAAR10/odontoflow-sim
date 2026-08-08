import { useEffect, useState } from "react";
import { OdontoProvider } from "@/store/OdontoStore";
import { Estacion } from "@/components/Estacion";
import { Bienvenida } from "@/components/Bienvenida";

const CLAVE_INICIO = "odontoflow:iniciada";

export function App() {
  const [iniciada, setIniciada] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(CLAVE_INICIO) === "1";
  });

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_INICIO, iniciada ? "1" : "0");
    } catch {
      /* almacenamiento bloqueado */
    }
  }, [iniciada]);

  return (
    <OdontoProvider>
      {iniciada ? (
        <Estacion onSalir={() => setIniciada(false)} />
      ) : (
        <Bienvenida onEmpezar={() => setIniciada(true)} />
      )}
    </OdontoProvider>
  );
}
