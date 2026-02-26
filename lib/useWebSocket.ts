"use client";
import { useEffect, useRef, useState, useCallback } from "react";

interface WsMessage {
    type: string;
    [key: string]: unknown;
}

export function useWebSocket(url: string | null) {
    const [messages, setMessages] = useState<WsMessage[]>([]);
    const [connected, setConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!url) return;
        let ws: WebSocket;
        try {
            ws = new WebSocket(url);
        } catch {
            setConnected(false);
            return;
        }
        wsRef.current = ws;

        ws.onopen = () => setConnected(true);
        ws.onclose = () => setConnected(false);
        ws.onerror = () => setConnected(false);
        ws.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                setMessages((prev) => [...prev, data]);
            } catch {
                // ignore
            }
        };

        return () => {
            ws.close();
            setMessages([]);
            setConnected(false);
        };
    }, [url]);

    const send = useCallback((content: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ content }));
        }
    }, []);

    const sendJson = useCallback((payload: Record<string, unknown>) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(payload));
        }
    }, []);

    return { messages, send, sendJson, connected, setMessages };
}
