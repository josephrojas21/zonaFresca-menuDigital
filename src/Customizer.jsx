import React, { useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import Modal from "./Modal";
import { money } from "./api";
export default function Customizer({
  product: p,
  catalog,
  onSave,
  close,
  initial,
}) {
  const [flavors, setFlavors] = useState(
    initial?.flavors ||
      Object.fromEntries(
        p.flavors.map((f, i) => [f, i === 0 ? p.includedScoops : 0]),
      ),
  );
  const [adds, setAdds] = useState(initial?.additions || []),
    [removals, setRemovals] = useState(initial?.removals || []),
    [variant, setVariant] = useState(initial?.variant || ""),
    [note, setNote] = useState(initial?.note || ""),
    [quantity, setQuantity] = useState(initial?.quantity || 1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const scoops = Object.values(flavors).reduce((a, b) => a + b, 0),
    noIce = removals.includes("helado");
  const extras =
    adds.reduce(
      (s, id) => s + catalog.additions.find((a) => a.id === id).price,
      0,
    ) +
    Math.max(0, scoops - p.includedScoops) * p.extraScoopPrice;
  function toggleRemoval(item) {
    setRemovals((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
    );
    if (item === "helado")
      setFlavors(
        Object.fromEntries(
          p.flavors.map((f, i) => [f, noIce && i === 0 ? p.includedScoops : 0]),
        ),
      );
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await onSave({
        id: initial?.id || crypto.randomUUID(),
        productId: p.id,
        quantity,
        flavors,
        additions: adds,
        removals,
        variant,
        note,
      });
      close();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`Personalizar ${p.name}`} close={close}>
      <div className="product-intro">
        <img src={p.image} alt="Imagen de referencia de la carta" />
        <div>
          <span className="eyebrow">{p.category}</span>
          <h2>{p.name}</h2>
          <strong className="price">{money(p.price)}</strong>
        </div>
      </div>
      <p className="muted">{p.description}</p>
      <p className="tiny">
        Imagen de referencia · Personalizaciones en demostración.
      </p>
      {p.includedScoops > 0 && (
        <section className="option-section">
          <div className="section-row">
            <h3>Elige tus sabores</h3>
            <span className="pill">
              {scoops} / {p.includedScoops} incluidas
            </span>
          </div>
          <p className="tiny">
            Puedes repetir sabor. Bola adicional: {money(p.extraScoopPrice)}{" "}
            (precio de prueba).
          </p>
          {p.flavors.map((f) => (
            <div className="option-row" key={f}>
              <span>{f}</span>
              <div className="stepper">
                <button
                  aria-label={`Quitar bola de ${f}`}
                  disabled={noIce || !flavors[f]}
                  onClick={() =>
                    setFlavors({ ...flavors, [f]: (flavors[f] || 0) - 1 })
                  }
                >
                  <Minus size={15} />
                </button>
                <b>{flavors[f] || 0}</b>
                <button
                  aria-label={`Agregar bola de ${f}`}
                  disabled={noIce || scoops >= p.maxScoops}
                  onClick={() =>
                    setFlavors({ ...flavors, [f]: (flavors[f] || 0) + 1 })
                  }
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
      {p.variants.length > 0 && (
        <label className="field">
          Escoge una variedad
          <select value={variant} onChange={(e) => setVariant(e.target.value)}>
            <option value="">Selecciona un sabor</option>
            {p.variants.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      )}
      {p.additions.length > 0 && (
        <section className="option-section">
          <h3>Un poquito más de lo que te gusta</h3>
          {catalog.additions
            .filter((a) => p.additions.includes(a.id))
            .map((a) => (
              <label className="option-row" key={a.id}>
                <span>
                  <input
                    type="checkbox"
                    checked={adds.includes(a.id)}
                    onChange={() =>
                      setAdds(
                        adds.includes(a.id)
                          ? adds.filter((x) => x !== a.id)
                          : [...adds, a.id],
                      )
                    }
                  />
                  {a.name}
                </span>
                <span>+ {money(a.price)}</span>
              </label>
            ))}
        </section>
      )}
      {p.removals.length > 0 && (
        <section className="option-section">
          <h3>Hazlo a tu manera</h3>
          <p className="tiny">Retirar ingredientes no cambia el precio.</p>
          <div className="removal-list">
            {p.removals.map((r) => (
              <label key={r}>
                <input
                  type="checkbox"
                  checked={removals.includes(r)}
                  onChange={() => toggleRemoval(r)}
                />
                Sin {r}
              </label>
            ))}
          </div>
        </section>
      )}
      <label className="field">
        ¿Algo que debamos tener en cuenta?
        <textarea
          maxLength={300}
          placeholder="Indicaciones para esta preparación…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <p className="tiny">
        Para unidades con instrucciones diferentes, agrégalas por separado.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-bottom">
        <div className="stepper large">
          <button
            aria-label="Reducir cantidad"
            disabled={quantity === 1}
            onClick={() => setQuantity(quantity - 1)}
          >
            <Minus size={18} />
          </button>
          <b>{quantity}</b>
          <button
            aria-label="Aumentar cantidad"
            disabled={quantity === 30}
            onClick={() => setQuantity(quantity + 1)}
          >
            <Plus size={18} />
          </button>
        </div>
        <button className="primary" onClick={submit} disabled={busy}>
          <ShoppingBag size={18} />
          {busy ? "Guardando…" : initial ? "Guardar" : "Agregar"} ·{" "}
          {money((p.price + extras) * quantity)}
        </button>
      </div>
    </Modal>
  );
}
