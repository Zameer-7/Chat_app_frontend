"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Mail, Lock, ArrowRight } from "lucide-react";
import NovaChatMark from "@/components/NovaChatMark";

export default function LoginPage() {
    const { login } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await login(email, password);
            router.replace("/chat");
        } catch (err: any) {
            setError(err?.message || "Login failed. Check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <div style={styles.logo}>
                    <div style={styles.logoIcon}>
                        <NovaChatMark size={34} />
                    </div>
                    <h1 style={styles.appName}>NovaChat</h1>
                </div>

                <h2 style={styles.title}>Welcome back</h2>
                <p style={styles.subtitle}>We're so excited to see you again!</p>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.field}>
                        <label style={styles.label}>Email Address</label>
                        <div style={styles.inputWrap}>
                            <Mail size={18} style={styles.inputIcon} />
                            <input
                                style={styles.input}
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                            />
                        </div>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>Password</label>
                        <div style={styles.inputWrap}>
                            <Lock size={18} style={styles.inputIcon} />
                            <input
                                style={styles.input}
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        <Link href="#" style={styles.forgot}>Forgot your password?</Link>
                    </div>

                    {error && <div style={styles.errorBox}>{error}</div>}

                    <button
                        className="btn-primary"
                        type="submit"
                        disabled={loading}
                        style={loading ? { ...styles.submitBtn, opacity: 0.7 } : styles.submitBtn}
                    >
                        {loading ? "Signing in..." : "Login"}
                    </button>

                    <p style={styles.footer}>
                        Need an account?{" "}
                        <Link href="/signup" style={styles.link}>Register</Link>
                    </p>
                </form>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "#0f1117",
        backgroundImage: "radial-gradient(circle at top right, #1d1e26, #0f1117)"
    },
    card: {
        background: "#161922",
        border: "1px solid #2d313e",
        borderRadius: 20,
        padding: "3.5rem 2.5rem",
        width: "100%",
        maxWidth: 440,
        boxShadow: "0 32px 64px -16px rgba(0,0,0,0.6)"
    },
    logo: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        marginBottom: "2rem"
    },
    logoIcon: {
        width: 56,
        height: 56,
        borderRadius: 16,
        background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 16px rgba(99, 102, 241, 0.3)"
    },
    appName: { fontSize: "1.6rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" },
    title: { fontSize: "1.75rem", fontWeight: 800, textAlign: "center", marginBottom: "0.5rem", color: "#fff" },
    subtitle: { color: "#9ca3af", textAlign: "center", marginBottom: "2.5rem", fontSize: "0.95rem" },
    form: { display: "flex", flexDirection: "column", gap: "1.5rem" },
    field: { display: "flex", flexDirection: "column", gap: "0.6rem" },
    label: { fontSize: "0.85rem", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" },
    inputWrap: { position: "relative", display: "flex", alignItems: "center" },
    inputIcon: { position: "absolute", left: 16, color: "#6b7280", zIndex: 1 },
    input: {
        width: "100%",
        background: "#0f1117",
        border: "1px solid #2d313e",
        padding: "1rem 1rem 1rem 3.5rem",
        borderRadius: 12,
        color: "#fff",
        fontSize: "1rem",
        outline: "none",
        transition: "border-color 0.2s, box-shadow 0.2s",
    },
    forgot: { color: "#818cf8", fontSize: "0.8rem", textDecoration: "none", width: "fit-content", cursor: "pointer" },
    errorBox: {
        background: "rgba(239, 68, 68, 0.1)",
        color: "#f87171",
        padding: "1rem",
        borderRadius: 10,
        fontSize: "0.875rem",
        border: "1px solid rgba(239, 68, 68, 0.2)",
        textAlign: "center"
    },
    submitBtn: {
        width: "100%",
        padding: "1rem",
        height: "auto",
        background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
        border: "none",
        borderRadius: 12,
        color: "#fff",
        fontSize: "1rem",
        fontWeight: 700,
        cursor: "pointer",
        boxShadow: "0 10px 20px -10px rgba(99, 102, 241, 0.5)",
        marginTop: "0.5rem"
    },
    footer: { textAlign: "center", marginTop: "1rem", fontSize: "0.9rem", color: "#9ca3af" },
    link: { color: "#818cf8", fontWeight: 600, textDecoration: "none" },
};
