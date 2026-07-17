// Modül içinden OPEX Lean Tool hub'ına (/) dönüş — sabit köşe pill'i.
// Statik modüllerdeki (5S, Gemba) inline sürümle görsel olarak birebir aynı.
export function HubBackLink() {
  return (
    <a
      href="/"
      aria-label="OPEX Lean Tool hub'ına dön"
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 90,
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "9px 15px",
        background: "#16294a",
        color: "#fff",
        font: "600 13px/1 -apple-system, system-ui, sans-serif",
        textDecoration: "none",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 999,
        boxShadow: "0 6px 22px -6px rgba(7,15,33,0.6)",
      }}
    >
      <span style={{ color: "#f7941e", fontSize: 15, lineHeight: 1 }}>←</span>
      OPEX Lean Tool
    </a>
  );
}
