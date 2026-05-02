import { useAppContext } from "../context/AppContext";

export function Notice() {
  const { notice, clearNotice } = useAppContext();
  if (!notice) return null;

  return (
    <div className="notice row">
      <span>{notice}</span>
      <button className="ghost" onClick={clearNotice}>Cerrar</button>
    </div>
  );
}
