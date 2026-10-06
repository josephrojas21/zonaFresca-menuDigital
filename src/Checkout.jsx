import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, MapPin, Store, ShieldCheck } from "lucide-react";
import Modal from "./Modal";
import { api, money } from "./api";
export default function Checkout({
  close,
  profile,
  onComplete,
  onForget,
  initialMethod,
  catalog,
}) {
  const [method, setMethod] = useState(initialMethod),
    [customer, setCustomer] = useState(
      profile || {
        buyer: "",
        recipient: "",
        phone: "",
        address: "",
        instructions: "",
      },
    ),
    [remember, setRemember] = useState(!!profile),
    [cash, setCash] = useState("exact"),
    [amount, setAmount] = useState(""),
    [summary, setSummary] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [order, setOrder] = useState(null);
  const key = useRef(crypto.randomUUID()),
    locked = useRef(false);
  function change(k, v) {
    setCustomer((prev) => ({ ...prev, [k]: v }));
    setSummary(null);
  }
  useEffect(() => {
    setSummary(null);
  }, [method]);
  async function review(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const q = await api("quote", {
        method,
        address: method === "delivery" ? customer.address : "",
      });
      setSummary(q);
      key.current = crypto.randomUUID();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api("orders", {
        key: key.current,
        quoteToken: summary.token,
        method,
        customer: {
          ...customer,
          ...(method === "pickup" ? { address: "", instructions: "" } : {}),
        },
        remember,
        payment: "cash",
        cash: cash === "exact" ? "exact" : Number(amount),
      });
      setOrder(result);
      onComplete(result, remember);
    } catch (e) {
      setError(e.message);
      if (e.quote) {
        setSummary(e.quote);
        key.current = crypto.randomUUID();
      }
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }
  async function forget() {
    try {
      await onForget();
      setCustomer({
        buyer: "",
        recipient: "",
        phone: "",
        address: "",
        instructions: "",
      });
      setRemember(false);
      setSummary(null);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Modal title="Finalizar pedido" close={close}>
      {order ? (
        <div className="success">
          <div className="success-icon">
            <Check size={34} />
          </div>
          <span className="eyebrow">TODO LISTO PARA ESTA PRUEBA</span>
          <h2>¡Qué buen antojo!</h2>
          <p>Tu pedido de demostración quedó guardado.</p>
          <p className="order-id">#{order.id.slice(0, 8).toUpperCase()}</p>
          <div className="notice">
            No se envió al local y no está en preparación. No debes realizar
            ningún pago.
          </div>
          <div className="totals">
            <p>
              <span>Total de prueba</span>
              <strong>{money(order.total)}</strong>
            </p>
            <p>
              <span>Pago</span>
              <span>Pendiente de cobro</span>
            </p>
          </div>
          <button className="primary full" onClick={close}>
            Volver al menú
          </button>
          <p className="tiny">
            Para otro destinatario o dirección, crea un nuevo pedido
            independiente.
          </p>
        </div>
      ) : (
        <>
          <span className="eyebrow">EL ÚLTIMO PASO</span>
          <h2>Tu antojo, a un paso.</h2>
          <p className="muted">Sin cuentas, sin contraseñas. Así de fácil.</p>
          <div className="notice">
            Pedido de demostración. No se enviará al local.
          </div>
          {!summary ? (
            <form onSubmit={review}>
              <div className="delivery-switch">
                <button
                  type="button"
                  className={method === "pickup" ? "selected" : ""}
                  onClick={() => setMethod("pickup")}
                >
                  <Store size={18} />
                  Recogida
                </button>
                <button
                  type="button"
                  className={method === "delivery" ? "selected" : ""}
                  onClick={() => setMethod("delivery")}
                >
                  <MapPin size={18} />
                  Domicilio
                </button>
              </div>
              <label className="field">
                Tu nombre
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  value={customer.buyer}
                  onChange={(e) => change("buyer", e.target.value)}
                />
              </label>
              <label className="field">
                ¿Quién recibe el pedido?
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={customer.recipient}
                  onChange={(e) => change("recipient", e.target.value)}
                  placeholder="Nombre del destinatario"
                />
              </label>
              <label className="field">
                Teléfono de contacto
                <input
                  required
                  type="tel"
                  pattern="[+0-9 ()\-]{7,20}"
                  maxLength={20}
                  autoComplete="tel"
                  value={customer.phone}
                  onChange={(e) => change("phone", e.target.value)}
                  placeholder="Número de contacto"
                />
              </label>
              {method === "delivery" && (
                <>
                  <label className="field">
                    Dirección completa
                    <input
                      required
                      minLength={8}
                      maxLength={200}
                      autoComplete="street-address"
                      value={customer.address}
                      onChange={(e) => change("address", e.target.value)}
                      placeholder="Calle, número, barrio y municipio"
                    />
                  </label>
                  <label className="field">
                    Indicaciones de entrega
                    <textarea
                      maxLength={300}
                      value={customer.instructions}
                      onChange={(e) => change("instructions", e.target.value)}
                      placeholder="Apartamento, unidad, punto de referencia…"
                    />
                  </label>
                  <p className="tiny">
                    La tarifa de {money(5000)} es simulada. La cobertura real
                    está pendiente de confirmar.
                  </p>
                </>
              )}
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Recordar mis datos en este dispositivo
              </label>
              <p className="tiny">
                Se guardan al confirmar, solo si lo autorizas. No se recuperan
                en otros dispositivos ni al borrar las cookies.
              </p>
              {profile && (
                <button type="button" className="text-button" onClick={forget}>
                  Olvidar mis datos guardados
                </button>
              )}
              <button disabled={busy} className="primary full">
                {busy ? "Calculando…" : "Revisar mi pedido"}
                <ShieldCheck size={18} />
              </button>
            </form>
          ) : (
            <>
              <button className="text-button" onClick={() => setSummary(null)}>
                <ArrowLeft size={16} />
                Modificar datos
              </button>
              <div className="review-address">
                <strong>
                  {method === "pickup"
                    ? "Recogida en el local"
                    : "Domicilio de prueba"}
                </strong>
                <p>
                  {customer.recipient} · {customer.phone}
                </p>
                {method === "delivery" && <p>{customer.address}</p>}
              </div>
              {summary.lines.map((l) => (
                <div className="review-line" key={l.id}>
                  <span>
                    {l.quantity} × {l.name}
                    <small>
                      {Object.entries(l.flavors)
                        .filter(([, n]) => n)
                        .map(([f, n]) => `${n} ${f}`)
                        .join(", ")}
                      {l.variant && ` · ${l.variant}`}
                      {l.additions
                        .map(
                          (id) =>
                            ` · + ${catalog.additions.find((a) => a.id === id)?.name || id}`,
                        )
                        .join("")}
                      {l.removals.map((r) => ` · sin ${r}`).join("")}
                      {l.note && ` · ${l.note}`}
                    </small>
                  </span>
                  <b>{money(l.total)}</b>
                </div>
              ))}
              <div className="totals">
                <p>
                  <span>Productos</span>
                  <span>{money(summary.base)}</span>
                </p>
                <p>
                  <span>Adiciones y bolas extra</span>
                  <span>{money(summary.extras)}</span>
                </p>
                <p>
                  <span>
                    {method === "pickup" ? "Recogida" : "Domicilio simulado"}
                  </span>
                  <span>{money(summary.delivery.fee)}</span>
                </p>
                <p className="grand-total">
                  <span>Total de prueba</span>
                  <b>{money(summary.total)}</b>
                </p>
              </div>
              <h3>Pago en efectivo</h3>
              <label className="check-line">
                <input
                  type="radio"
                  name="cash"
                  checked={cash === "exact"}
                  onChange={() => setCash("exact")}
                />
                Pago exacto
              </label>
              <label className="check-line">
                <input
                  type="radio"
                  name="cash"
                  checked={cash === "amount"}
                  onChange={() => setCash("amount")}
                />
                Necesito cambio
              </label>
              {cash === "amount" && (
                <label className="field">
                  ¿Con cuánto pagas?
                  <input
                    type="number"
                    min={summary.total}
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
              )}
              <p className="tiny">
                Transferencia no disponible hasta verificar los datos del
                negocio.
              </p>
              <button
                className="primary full"
                disabled={
                  busy ||
                  (cash === "amount" &&
                    (!amount || Number(amount) < summary.total))
                }
                onClick={confirm}
              >
                {busy ? "Guardando…" : "Confirmar pedido de prueba"}
              </button>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
