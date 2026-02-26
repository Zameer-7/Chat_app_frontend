"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://chat-app-backend-kmr3.onrender.com";

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
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    signup: (username: string, nickname: string, email: string, password: string) => Promise<void>;
    updateProfile: (data: { nickname?: string, username?: string }) => Promise<void>;
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
        } catch (err) {
            console.error("Failed to fetch user:", err);
            localStorage.removeItem("token");
            setToken(null);
            setUser(null);
        }
    }, []);

    useEffect(() => {
        const stored = localStorage.getItem("token");
        if (stored) {
            setToken(stored);
            fetchMe(stored).finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [fetchMe]);

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

    const updateProfile = async (data: { nickname?: string, username?: string }) => {
        if (!token) return;
        try {
            const res = await axios.patch(`${API_URL}/users/me`, data, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(res.data);
        } catch (err) {
            console.error("Update profile failed:", err);
            throw err;
        }
    };

    const logout = () => {
        localStorage.removeItem("token");
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
