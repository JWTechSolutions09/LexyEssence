import { useState } from "react";
import { useAppContext } from "../context/AppContext";

export function SettingsPage() {
  const { setNotice } = useAppContext();
  const [storeName, setStoreName] = useState("Lexy Essence");
  const [currencyCode, setCurrencyCode] = useState("USD");

  function saveSettings() {
    setNotice(`Configuración guardada: ${storeName} (${currencyCode}).`);
  }

  function resetSettings() {
    setStoreName("Lexy Essence");
    setCurrencyCode("USD");
    setNotice("Configuración restaurada.");
  }

  return (
    <section>
      <div className="row">
        <h1>Configuración</h1>
        <div className="actions">
          <button className="ghost" onClick={resetSettings}>Restaurar</button>
          <button onClick={saveSettings}>Guardar</button>
        </div>
      </div>
      <div className="card settings-form">
        <label>
          Nombre del negocio
          <input value={storeName} onChange={(e) => setStoreName(e.target.value)} />
        </label>
        <label>
          Moneda
          <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}>
            <option value="USD">USD</option>
            <option value="DOP">DOP</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
      </div>
    </section>
  );
}
