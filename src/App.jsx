import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Search,
  ShoppingBag,
  Plus,
  Minus,
  IceCreamBowl,
  Sparkles,
  Heart,
  UtensilsCrossed,
  GlassWater,
  Cherry,
  Store,
  MapPin,
  Trash2,
  Pencil,
  X,
  Check,
  Instagram,
} from "lucide-react";
import { api, money } from "./api";
import Customizer from "./Customizer";
import Checkout from "./Checkout";
import Modal from "./Modal";
const icons = {
  Todos: UtensilsCrossed,
  Ensaladas: Cherry,
  Copas: IceCreamBowl,
  Salpicones: GlassWater,
  Antojos: Heart,
  Bebidas: GlassWater,
  Infantil: Sparkles,
  Salados: UtensilsCrossed,
  "Conos y más": IceCreamBowl,
};
const normalize = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export default function App() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("Todos"),
    [selected, setSelected] = useState(null),
    [cartOpen, setCartOpen] = useState(false),
    [checkout, setCheckout] = useState(false),
    [method, setMethod] = useState("pickup"),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState("");
  const mutation = useRef(false);
  async function load() {
    setError("");
    try {
      setData(await api("bootstrap"));
    } catch {
      setError(
        "No pudimos cargar el menú. Revisa tu conexión e intenta otra vez.",
      );
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 2800);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  async function updateCart(cart) {
    if (mutation.current)
      throw Error("Espera a que se guarde el cambio anterior.");
    mutation.current = true;
    setBusy(true);
    try {
      const r = await api("cart", { cart }, "PUT");
      setData((d) => ({ ...d, ...r, cartError: null }));
      return r;
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  async function save(line) {
    await updateCart(
      selected?.line
        ? data.cart.map((l) => (l.id === line.id ? line : l))
        : [...data.cart, line],
    );
    setToast(
      selected?.line ? "Personalización guardada" : "¡Agregado a tu pedido!",
    );
  }
  async function changeLine(id, delta) {
    try {
      await updateCart(
        data.cart
          .map((l) =>
            l.id === id ? { ...l, quantity: l.quantity + delta } : l,
          )
          .filter((l) => l.quantity > 0),
      );
    } catch (e) {
      setError(e.message);
    }
  }
  async function remove(id) {
    try {
      await updateCart(data.cart.filter((l) => l.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }
  async function forget() {
    await api("profile", {}, "DELETE");
    setData((d) => ({ ...d, profile: null }));
    setToast("Datos olvidados en este dispositivo");
  }
  const count =
      data?.priced?.count ||
      data?.cart.reduce((s, l) => s + l.quantity, 0) ||
      0,
    subtotal = data?.priced?.subtotal || 0;
  const categories = [
    "Todos",
    ...new Set(data?.catalog.products.map((p) => p.category) || []),
  ];
  const products =
    data?.catalog.products.filter(
      (p) =>
        (category === "Todos" || p.category === category) &&
        normalize([p.name, p.description, ...p.aliases].join(" ")).includes(
          normalize(search),
        ),
    ) || [];
  const featured = products.filter((p) =>
    ["ensalada-zf", "banana-split", "copa-zf", "arepa-zf"].includes(p.id),
  );
  function cards(list) {
    return list.map((p) => (
      <article className="product-card" key={p.id}>
        <button
          className="photo-button"
          onClick={() => setSelected({ product: p })}
          disabled={!p.available}
          aria-label={`Ver ${p.name}`}
        >
          <img
            src={p.image}
            alt={`${p.name} · imagen de referencia`}
            loading="lazy"
          />
          {p.featured && (
            <span className="favorite">
              <Sparkles size={12} />
              De la casa
            </span>
          )}
          <span className="image-reference">Imagen de referencia</span>
        </button>
        <div className="card-body">
          <span className="card-category">{p.category}</span>
          <h3>{p.name}</h3>
          <p>{p.description}</p>
          <div className="card-bottom">
            <strong>
              {p.price === null ? "Por confirmar" : money(p.price)}
            </strong>
            <button
              className="add-button"
              disabled={!p.available}
              aria-label={`Agregar ${p.name}`}
              onClick={() => setSelected({ product: p })}
            >
              {p.available ? (
                <Plus size={21} />
              ) : (
                <span>{p.price === null ? "Pronto" : "Agotado"}</span>
              )}
            </button>
          </div>
        </div>
      </article>
    ));
  }
  return (
    <>
      <div className="demo-bar">
        ESTÁS EXPLORANDO UNA DEMOSTRACIÓN{" "}
        <span>· No se realizan pedidos reales</span>
      </div>
      <header className="header">
        <a href="#" className="brand" aria-label="Zona Fresca, inicio">
          <span className="brand-icon">
            <IceCreamBowl size={27} />
          </span>
          <span>
            ZONA FRESCA<small>DULCE & SALADO</small>
          </span>
        </a>
        <nav className="header-nav">
          <a href="#menu">Nuestro menú</a>
          <span className="header-note">Un antojo para cada momento</span>
        </nav>
        <button
          aria-label={`Mi pedido, ${count} productos`}
          className="header-cart"
          onClick={() => setCartOpen(true)}
        >
          <ShoppingBag size={18} />
          <span>Mi pedido</span>
          <b>{count}</b>
        </button>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="little-line" />
              HECHO PARA DISFRUTAR
            </span>
            <h1>
              La felicidad
              <br />
              se sirve <em>fresca.</em>
            </h1>
            <p>
              Un poquito dulce, un poquito salado.
              <br />
              Encuentra ese antojo que te alegra el día.
            </p>
            <a className="primary hero-cta" href="#menu">
              Encuentra tu antojo
              <ArrowDown size={18} />
            </a>
            <div className="hero-caption">
              <Heart size={15} /> A tu gusto, desde la primera cucharada.
            </div>
          </div>
          <div className="hero-art">
            <div className="hero-ring" />
            <img
              className="hero-photo"
              src="/images/banana.jpg"
              alt="Helado con fruta, imagen de referencia tomada de la carta de Zona Fresca"
            />
            <span className="hero-sticker">
              DULCE
              <br />
              <Heart size={22} />
              <br />
              MOMENTO
            </span>
            <div className="hero-photo-caption">
              <span>ASÍ SABE LA FELICIDAD</span>
              <b>¿Y si hoy te das un gusto?</b>
            </div>
            <span className="hero-sparkle one">✳</span>
            <span className="hero-sparkle two">✧</span>
          </div>
        </section>
        <div className="values-strip">
          <span>
            <IceCreamBowl size={18} />
            Sabores que enamoran
          </span>
          <i />
          <span>
            <UtensilsCrossed size={18} />
            Dulce y salado
          </span>
          <i />
          <span>
            <Heart size={18} />
            Preparado a tu gusto
          </span>
        </div>
        <section id="menu" className="menu-section">
          <div className="menu-heading">
            <div>
              <span className="eyebrow">ELIGE, COMBINA Y DISFRUTA</span>
              <h2>¿Qué se te antoja hoy?</h2>
            </div>
            <div className="delivery-switch compact">
              <button
                className={method === "pickup" ? "selected" : ""}
                onClick={() => setMethod("pickup")}
              >
                <Store size={16} />
                Recogida
              </button>
              <button
                className={method === "delivery" ? "selected" : ""}
                onClick={() => setMethod("delivery")}
              >
                <MapPin size={16} />
                Domicilio
              </button>
            </div>
          </div>
          <div className="menu-toolbar">
            <label className="search">
              <Search size={19} />
              <input
                aria-label="Buscar un antojo"
                placeholder="Busca tu antojo favorito…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  aria-label="Limpiar búsqueda"
                  onClick={() => setSearch("")}
                >
                  <X size={16} />
                </button>
              )}
            </label>
            <span className="catalog-note">
              Precios en pesos colombianos · COP
            </span>
          </div>
          <nav className="categories" aria-label="Categorías">
            {categories.map((c) => {
              const Icon = icons[c];
              return (
                <button
                  key={c}
                  className={category === c ? "active" : ""}
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  <Icon size={17} />
                  {c}
                </button>
              );
            })}
          </nav>
          {error && (
            <div className="error" role="alert">
              {error}
              <button className="text-button" onClick={load}>
                Volver a intentar
              </button>
            </div>
          )}
          {!data && !error ? (
            <div className="empty" role="status">
              Preparando nuestro menú…
            </div>
          ) : (
            <div className="catalog-layout">
              <div>
                {category === "Todos" && !search && (
                  <>
                    <div className="section-title">
                      <div>
                        <span className="eyebrow">
                          TIENEN UN LUGAR ESPECIAL
                        </span>
                        <h2>
                          Los de la casa <span>✦</span>
                        </h2>
                      </div>
                      <span className="tiny">Un buen lugar para empezar</span>
                    </div>
                    <div className="product-grid">{cards(featured)}</div>
                    <div className="editorial-banner">
                      <IceCreamBowl size={32} />
                      <div>
                        <h3>Tu helado. Tus reglas.</h3>
                        <p>
                          Elige tus sabores, suma lo que te gusta y hazlo tuyo.
                        </p>
                      </div>
                      <span>✧</span>
                    </div>
                  </>
                )}
                <div className="section-title">
                  <h2>
                    {search
                      ? `Resultados para “${search}”`
                      : category === "Todos"
                        ? "Todos los antojos"
                        : category}
                  </h2>
                  <span className="tiny">{products.length} productos</span>
                </div>
                {products.length ? (
                  <div className="product-grid">{cards(products)}</div>
                ) : (
                  <div className="empty">
                    <Search size={32} />
                    <h3>No encontramos ese antojo</h3>
                    <p>
                      Prueba con “banana”, “helado” o una categoría diferente.
                    </p>
                    <button
                      className="secondary"
                      onClick={() => {
                        setSearch("");
                        setCategory("Todos");
                      }}
                    >
                      Ver todo el menú
                    </button>
                  </div>
                )}
                <p className="source-note">
                  {data?.catalog.notice} Las imágenes son referencias extraídas
                  de la carta; las reemplazaremos por fotos de cada producto.
                </p>
              </div>
              <aside className="cart-sidebar">{renderCartContent()}</aside>
            </div>
          )}
        </section>
      </main>
      <footer>
        <a href="#" className="brand">
          <IceCreamBowl size={26} />
          <span>
            ZONA FRESCA<small>DULCE & SALADO</small>
          </span>
        </a>
        <p>¡La felicidad sí existe, y se derrite!</p>
        <a
          href="https://www.instagram.com/zonafrescasabaneta/"
          target="_blank"
          rel="noreferrer"
        >
          <Instagram size={17} />
          @zonafrescasabaneta
        </a>
        {data?.profile && (
          <button
            className="text-button"
            onClick={() => forget().catch((e) => setError(e.message))}
          >
            Olvidar mis datos
          </button>
        )}
      </footer>
      {count > 0 && (
        <button className="mobile-cart" onClick={() => setCartOpen(true)}>
          <span className="cart-count">{count}</span>
          <span>Ver mi pedido</span>
          <b>{money(subtotal)}</b>
          <ArrowRight size={18} />
        </button>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      {selected && (
        <Customizer
          key={selected.line?.id || selected.product.id}
          product={selected.product}
          initial={selected.line}
          catalog={data.catalog}
          onSave={save}
          close={() => setSelected(null)}
        />
      )}
      {cartOpen && !selected && (
        <Modal title="Mi pedido" close={() => setCartOpen(false)}>
          {renderCartContent()}
        </Modal>
      )}
      {checkout && (
        <Checkout
          catalog={data.catalog}
          initialMethod={method}
          profile={data.profile}
          onForget={forget}
          close={() => setCheckout(false)}
          onComplete={(order, remember) => {
            setData((d) => ({
              ...d,
              cart: [],
              priced: { lines: [], base: 0, extras: 0, subtotal: 0, count: 0 },
              profile: remember ? order.customer : null,
            }));
          }}
        />
      )}
    </>
  );
  function renderCartContent() {
    return (
      <>
        <div className="cart-title">
          <h3>Mi pedido</h3>
          <ShoppingBag size={20} />
        </div>
        <span className="tiny">Tu próxima pausa favorita</span>
        {count === 0 ? (
          <div className="empty-cart">
            <span>
              <ShoppingBag size={34} strokeWidth={1.2} />
            </span>
            <h4>Un antojo te espera</h4>
            <p>
              Agrega algo rico del menú
              <br />y empieza a armar tu pedido.
            </p>
          </div>
        ) : (
          <>
            <div className="cart-lines">
              {data.cart.map((line) => {
                const p = data.catalog.products.find(
                    (p) => p.id === line.productId,
                  ),
                  priced = data.priced?.lines.find((l) => l.id === line.id);
                return (
                  <div className="cart-line" key={line.id}>
                    <div className="cart-line-top">
                      <strong>{p?.name || "Producto"}</strong>
                      <button
                        className="small-icon"
                        aria-label={`Eliminar ${p?.name}`}
                        disabled={busy}
                        onClick={() => remove(line.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p>
                      {Object.entries(line.flavors)
                        .filter(([, n]) => n)
                        .map(([f, n]) => `${n} ${f}`)
                        .join(" · ")}
                      {line.variant && ` · ${line.variant}`}
                      {line.removals.map((r) => ` · Sin ${r}`).join("")}
                      {line.additions
                        .map(
                          (a) =>
                            ` · + ${data.catalog.additions.find((x) => x.id === a)?.name}`,
                        )
                        .join("")}
                      {line.note && ` · ${line.note}`}
                    </p>
                    <button
                      className="edit-line"
                      disabled={busy}
                      onClick={() => setSelected({ product: p, line })}
                    >
                      <Pencil size={12} />
                      Personalizar
                    </button>
                    <div className="section-row">
                      <div className="stepper">
                        <button
                          disabled={busy}
                          aria-label={`Quitar una unidad de ${p?.name}`}
                          onClick={() => changeLine(line.id, -1)}
                        >
                          <Minus size={13} />
                        </button>
                        <b>{line.quantity}</b>
                        <button
                          disabled={busy || line.quantity >= 30}
                          aria-label={`Sumar una unidad de ${p?.name}`}
                          onClick={() => changeLine(line.id, 1)}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <strong>
                        {priced ? money(priced.total) : "Revisar"}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
            {data.cartError && <p className="error">{data.cartError}</p>}
            <div className="totals">
              <p>
                <span>Productos</span>
                <span>{money(data.priced?.base || 0)}</span>
              </p>
              <p>
                <span>Adiciones</span>
                <span>{money(data.priced?.extras || 0)}</span>
              </p>
              <p className="subtotal">
                <span>Subtotal</span>
                <b>{money(subtotal)}</b>
              </p>
              {method === "delivery" && (
                <p className="tiny">Domicilio por calcular</p>
              )}
            </div>
            <button
              className="primary full"
              disabled={busy || !!data.cartError}
              onClick={() => {
                setCartOpen(false);
                setCheckout(true);
              }}
            >
              Continuar
              <ArrowRight size={17} />
            </button>
          </>
        )}
        <div className="cart-foot">
          <Check size={14} />
          Compra sin crear una cuenta
        </div>
        <p className="tiny center">Modo demostración · sin pedidos reales</p>
      </>
    );
  }
}
