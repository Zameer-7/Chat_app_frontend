"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://chat-app-backend-kmr3.onrender.com";
const CLOSED_AT_KEY = "app_closed_at";
const CLOSE_LOGOUT_MS = 5 * 60 * 1000;

function getApiErrorMessage(err: unknown, fallback: string): string {
    if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        if (typeof detail === "string") return detail;
        if (Array.isArray(detail)) {
            const first = detail[0];
            if (typeof first === "string") return first;
            if (first?.msg) return String(first.msg);
        }
        if (typeof err.message === "string" && err.message) return err.message;
    }
    return fallback;
}

interface User {
    id: number;
    username: string;
    nickname: string;
    email: string;
    created_at: string;
    last_username_change: string | null;
    last_seen_at: string | null;
    show_last_seen: boolean;
    show_online_status: boolean;
    theme_mode: "dark" | "light";
    theme_accent: "purple" | "blue" | "green" | "rose";
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    signup: (username: string, nickname: string, email: string, password: string) => Promise<void>;
    updateProfile: (data: { nickname?: string, username?: string, show_last_seen?: boolean, show_online_status?: boolean, theme_mode?: "dark" | "light", theme_accent?: "purple" | "blue" | "green" | "rose" }) => Promise<void>;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchMe = useCallback(async (tkn: string) => {
        try {
            const res = await axios.get(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${tkn}` },
            });
            setUser(res.data);
            if (typeof document !== "undefined") {
                document.documentElement.setAttribute("data-theme", res.data.theme_mode || "dark");
                document.documentElement.setAttribute("data-accent", res.data.theme_accent || "purple");
            }
        } catch (err) {
            console.error("Failed to fetch user:", err);
            localStorage.removeItem("token");
            setToken(null);
            setUser(null);
        }
    }, []);

    useEffect(() => {
        const closedAtRaw = localStorage.getItem(CLOSED_AT_KEY);
        if (closedAtRaw) {
            const closedAt = Number(closedAtRaw);
            if (Number.isFinite(closedAt) && Date.now() - closedAt > CLOSE_LOGOUT_MS) {
                localStorage.removeItem("token");
            }
            localStorage.removeItem(CLOSED_AT_KEY);
        }
        const stored = localStorage.getItem("token");
        if (stored) {
            setToken(stored);
            fetchMe(stored).finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [fetchMe]);

    useEffect(() => {
        const markClosed = () => {
            try {
                localStorage.setItem(CLOSED_AT_KEY, String(Date.now()));
            } catch {}
        };
        window.addEventListener("pagehide", markClosed);
        window.addEventListener("beforeunload", markClosed);
        return () => {
            window.removeEventListener("pagehide", markClosed);
            window.removeEventListener("beforeunload", markClosed);
        };
    }, []);

    const login = async (email: string, password: string) => {
        try {
            const res = await axios.post(`${API_URL}/auth/login`, { email, password });
            const tkn = res.data.access_token;
            localStorage.setItem("token", tkn);
            setToken(tkn);
            await fetchMe(tkn);
        } catch (err) {
            console.error("Login request failed:", err);
            throw new Error(getApiErrorMessage(err, "Login failed. Check your credentials."));
        }
    };

    const signup = async (username: string, nickname: string, email: string, password: string) => {
        try {
            const res = await axios.post(`${API_URL}/auth/signup`, { username, nickname, email, password });
            const tkn = res.data.access_token;
            localStorage.setItem("token", tkn);
            setToken(tkn);
            await fetchMe(tkn);
        } catch (err) {
            console.error("Signup request failed:", err);
            throw new Error(getApiErrorMessage(err, "Signup failed. Try a different username/email."));
        }
    };

    const updateProfile = async (data: { nickname?: string, username?: string, show_last_seen?: boolean, show_online_status?: boolean, theme_mode?: "dark" | "light", theme_accent?: "purple" | "blue" | "green" | "rose" }) => {
        if (!token) return;
        try {
            const res = await axios.patch(`${API_URL}/users/me`, data, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(res.data);
            if (typeof document !== "undefined") {
                document.documentElement.setAttribute("data-theme", res.data.theme_mode || "dark");
                document.documentElement.setAttribute("data-accent", res.data.theme_accent || "purple");
            }
        } catch (err) {
            console.error("Update profile failed:", err);
            throw err;
        }
    };

    const logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem(CLOSED_AT_KEY);
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, signup, updateProfile, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be inside AuthProvider");
    return ctx;
}
