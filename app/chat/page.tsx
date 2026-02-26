"use client";
import { MessageCircle } from "lucide-react";

export default function ChatIndexPage() {
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, color: "var(--text-muted)" }}>
            <MessageCircle size={56} color="#2e3250" />
            <h2 style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--text-muted)" }}>Pick a room or start a DM</h2>
            <p style={{ fontSize: "0.875rem" }}>Select from the sidebar to start chatting</p>
        </div>
    );
}
