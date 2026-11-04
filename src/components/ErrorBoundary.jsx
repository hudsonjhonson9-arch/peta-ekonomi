import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 32,
          maxWidth: 620,
          margin: "40px auto",
          textAlign: "center",
          background: "#ffffff",
          borderRadius: 16,
          border: "1px solid #E2E8F0",
          boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
          fontFamily: "inherit"
        }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            background: "#FEF2F2",
            color: "#DC2626",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px auto",
            fontSize: 22,
            fontWeight: 800
          }}>
            !
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px 0", color: "#0F172A" }}>
            Terjadi Kesalahan pada Halaman Ini
          </h3>
          <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 24px 0", lineHeight: 1.6 }}>
            {this.state.error?.message || "Halaman tidak dapat ditampilkan karena kendala tak terduga."}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.hash = "#dashboard";
                window.location.reload();
              }}
              style={{
                padding: "9px 18px",
                borderRadius: 8,
                background: "#2563EB",
                color: "#ffffff",
                border: "none",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer"
              }}
            >
              Kembali ke Beranda
            </button>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                padding: "9px 18px",
                borderRadius: 8,
                background: "#F1F5F9",
                color: "#475569",
                border: "1px solid #E2E8F0",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer"
              }}
            >
              Coba Lagi
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

