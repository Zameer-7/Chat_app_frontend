"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Send, Edit2, Trash2, Check, X, Reply, SmilePlus, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWebSocket } from "@/lib/useWebSocket";
import api from "@/lib/api";

const REPLY_PREFIX = /^\[\[reply:(.+?)\]\]\n?/;

type ReplyMeta = {
    id: number;
    username: string;
    nickname: string;
    content: string;
};

function parseMessageContent(raw: string) {
    const match = raw.match(REPLY_PREFIX);
    if (!match) return { body: raw, reply: null as ReplyMeta | null, prefix: "" };
    try {
        const prefix = match[0];
        const reply = JSON.parse(decodeURIComponent(match[1])) as ReplyMeta;
        const body = raw.slice(prefix.length);
        return { body, reply, prefix };
    } catch {
        return { body: raw, reply: null as ReplyMeta | null, prefix: "" };
    }
}

function buildMessageContent(body: string, reply: ReplyMeta | null) {
    if (!reply) return body;
    return `[[reply:${encodeURIComponent(JSON.stringify(reply))}]]\n${body}`;
}

export default function DMChatPage() {
    const { userId } = useParams();
    const router = useRouter();
    const { user, token } = useAuth();
    const [otherUser, setOtherUser] = useState<any>(null);
    const [input, setInput] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState("");
    const [replyingTo, setReplyingTo] = useState<ReplyMeta | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const touchStartRef = useRef<number | null>(null);

    const wsUrl = token ? `${process.env.NEXT_PUBLIC_WS_URL}/ws/dms/${userId}?token=${token}` : null;
    const { messages, send, setMessages, connected } = useWebSocket(wsUrl);

    useEffect(() => {
        api.get(`/dms/${userId}`).then((res) => {
            setMessages(res.data.map((m: any) => ({ type: "dm", ...m })));
        });
        api.get("/friends/all").then((res) => {
            const found = (res.data as any[]).find((u) => u.id === Number(userId));
            if (found) setOtherUser(found);
            else {
                api.get(`/users/search?q=`).then((res2) => {
                    const found2 = (res2.data as any[]).find((u) => u.id === Number(userId));
                    if (found2) setOtherUser(found2);
                });
            }
        });
    }, [userId, setMessages]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") router.push("/chat");
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [router]);

    const onInput = (value: string) => {
        setInput(value);
        setIsTyping(value.trim().length > 0);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setIsTyping(false), 1200);
    };

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim()) return;
        send(buildMessageContent(input.trim(), replyingTo));
        setInput("");
        setReplyingTo(null);
        setIsTyping(false);
    };

    const handleDelete = async (msgId: number) => {
        if (!confirm("Delete this message?")) return;
        try {
            await api.delete(`/dms/messages/${msgId}`);
            setMessages((prev) => (prev as any[]).map((m) => (m.id === msgId ? { ...m, content: "This message was deleted", is_deleted: true } : m)));
        } catch (err) {
            console.error(err);
        }
    };

    const startEdit = (msg: any) => {
        setEditingId(msg.id);
        setEditValue(parseMessageContent(String(msg.content || "")).body);
    };

    const handleEditSave = async (msgId: number) => {
        if (!editValue.trim()) return;
        try {
            const current = (messages as any[]).find((m) => m.id === msgId);
            const parsed = parseMessageContent(String(current?.content || ""));
            const payload = { content: `${parsed.prefix}${editValue.trim()}` };
            const res = await api.patch(`/dms/messages/${msgId}`, payload);
            setMessages((prev) => (prev as any[]).map((m) => (m.id === msgId ? { ...m, ...res.data, type: "dm" } : m)));
            setEditingId(null);
            setEditValue("");
        } catch (err) {
            console.error(err);
        }
    };

    if (!otherUser) return <div style={s.center}>Loading conversation...</div>;
    const addEmoji = (emoji: string) => setInput((prev) => `${prev}${emoji}`);

    return (
        <div
            style={s.container}
            onTouchStart={(e) => { touchStartRef.current = e.changedTouches[0]?.clientX ?? null; }}
            onTouchEnd={(e) => {
                if (touchStartRef.current == null) return;
                const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartRef.current;
                if (dx > 80) router.push("/chat");
                touchStartRef.current = null;
            }}
        >
            <header style={s.header} className="glass">
                <div style={s.headerInfo}>
                    <button style={s.toolBtn} onClick={() => router.push("/chat")}><ArrowLeft size={15} /></button>
                    <div style={s.avatarSmall}>{otherUser.nickname[0].toUpperCase()}</div>
                    <div>
                        <h2 style={s.roomName}>{otherUser.nickname}</h2>
                        <span style={s.usernameSmall}>@{otherUser.username}</span>
                    </div>
                </div>
                <div style={s.headerStatus}>
                    <span className="pulse-dot" style={{ ...s.statusDot, background: connected ? "var(--success)" : "var(--danger)", color: connected ? "var(--success)" : "var(--danger)" }} />
                    <span style={s.statusText}>{connected ? "Online" : "Offline"}</span>
                </div>
            </header>

            <div style={s.messageArea} ref={scrollRef}>
                <div style={s.historyWall}>
                    {(messages as any[]).map((m: any, i) => {
                        const isMe = m.sender_id === user?.id;
                        const isEditing = editingId === m.id;
                        const parsed = parseMessageContent(String(m.content || ""));

                        return (
                            <div key={i} style={{ ...s.msgRow, flexDirection: isMe ? "row-reverse" : "row", animation: "messageIn 0.24s ease" }}>
                                <div style={{ ...s.msgCol, alignItems: isMe ? "flex-end" : "flex-start" }}>
                                    <div style={s.msgMeta}>
                                        <span style={s.msgTime}>{m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                                        {!!m.updated_at && !m.is_deleted && <span style={s.editedTag}>edited</span>}
                                        {isMe && <span style={s.seenTag}>Seen</span>}
                                        <div style={s.msgActions}>
                                            {!m.is_deleted && !isEditing && <button onClick={() => setReplyingTo({ id: m.id, username: isMe ? user?.username || "" : otherUser.username || "", nickname: isMe ? user?.nickname || "You" : otherUser.nickname || "User", content: parsed.body.slice(0, 120) })} style={s.actionBtn}><Reply size={12} /></button>}
                                            {isMe && !m.is_deleted && !isEditing && <button onClick={() => startEdit(m)} style={s.actionBtn}><Edit2 size={12} /></button>}
                                            {isMe && !m.is_deleted && !isEditing && <button onClick={() => handleDelete(m.id)} style={s.actionBtn}><Trash2 size={12} /></button>}
                                        </div>
                                    </div>

                                    {isEditing ? (
                                        <div style={s.editWrap}>
                                            <input style={s.editInput} value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
                                            <div style={s.editActions}>
                                                <button onClick={() => handleEditSave(m.id)} style={s.actionBtn}><Check size={14} /></button>
                                                <button onClick={() => setEditingId(null)} style={s.actionBtn}><X size={14} /></button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ ...s.bubble, ...(isMe ? s.myBubble : s.otherBubble), opacity: m.is_deleted ? 0.6 : 1, fontStyle: m.is_deleted ? "italic" : "normal", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                            {parsed.reply && (
                                                <div style={s.replyPreview}>
                                                    <p style={s.replyAuthor}>Reply to @{parsed.reply.username || parsed.reply.nickname}</p>
                                                    <p style={s.replyText}>{parsed.reply.content}</p>
                                                </div>
                                            )}
                                            {parsed.body}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <form onSubmit={handleSend} style={s.inputArea} className="glass">
                {replyingTo && (
                    <div style={s.replyComposer}>
                        <div>
                            <p style={s.replyComposerTitle}>Replying to @{replyingTo.username || replyingTo.nickname}</p>
                            <p style={s.replyComposerText}>{replyingTo.content}</p>
                        </div>
                        <button type="button" style={s.actionBtn} onClick={() => setReplyingTo(null)}><X size={14} /></button>
                    </div>
                )}
                {isTyping && <p style={s.typing}>You are typing...</p>}
                <div style={s.inputRow}>
                    <button type="button" style={s.toolBtn} onClick={() => setShowEmoji((v) => !v)}><SmilePlus size={16} /></button>
                    <input value={input} onChange={(e) => onInput(e.target.value)} placeholder={`Message @${otherUser.nickname}`} style={s.input} autoFocus />
                    <button type="submit" disabled={!input.trim()} style={{ ...s.sendBtn, opacity: input.trim() ? 1 : 0.45 }}><Send size={18} /></button>
                </div>
                {showEmoji && (
                    <div style={s.emojiWrap}>
                        {["\u{1F600}","\u{1F602}","\u{1F60D}","\u{1F973}","\u{1F525}","\u{1F44D}","\u{1F64F}","\u{2764}\u{FE0F}","\u{1F60E}","\u{1F91D}","\u{1F389}","\u{1F680}","\u{1F605}","\u{1F622}","\u{1F914}","\u{1F64C}"].map((e) => (
                            <button key={e} type="button" style={s.emojiBtn} onClick={() => addEmoji(e)}>{e}</button>
                        ))}
                    </div>
                )}
            </form>
        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    container: { display: "flex", flexDirection: "column", height: "100%", background: "radial-gradient(circle at 10% -10%, rgba(119,101,255,0.14), transparent 46%), #0c1122" },
    header: { height: 70, padding: "0 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(140,148,204,0.2)" },
    headerInfo: { display: "flex", alignItems: "center", gap: 10 },
    roomName: { fontWeight: 800, fontSize: "1rem" },
    usernameSmall: { fontSize: "0.75rem", color: "var(--text-muted)" },
    headerStatus: { display: "flex", alignItems: "center", gap: 8 },
    statusDot: { width: 8, height: 8, borderRadius: 999, display: "inline-block" },
    statusText: { fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700 },
    avatarSmall: { width: 36, height: 36, borderRadius: 12, background: "linear-gradient(135deg,var(--accent),var(--accent-2))", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff" },
    messageArea: { flex: 1, overflowY: "auto" },
    historyWall: { padding: "1rem", display: "flex", flexDirection: "column", gap: "0.9rem" },
    msgRow: { display: "flex", gap: 10, maxWidth: "86%" },
    msgCol: { display: "flex", flexDirection: "column", gap: 4 },
    msgMeta: { display: "flex", alignItems: "center", gap: 6, fontSize: "0.74rem" },
    msgTime: { color: "var(--text-muted)" },
    editedTag: { color: "#bcc2ff", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em" },
    seenTag: { color: "#7fd1ff", fontSize: "0.68rem" },
    msgActions: { display: "flex", gap: 2 },
    actionBtn: { border: "none", background: "transparent", color: "#aeb4e8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, padding: 3 },
    bubble: { padding: "0.7rem 0.9rem", borderRadius: 16, fontSize: "0.93rem", lineHeight: "1.45", color: "#fff", whiteSpace: "pre-wrap", boxShadow: "0 10px 18px rgba(5,8,20,0.35)" },
    myBubble: { background: "linear-gradient(138deg, #7a69ff 0%, #5f4de9 100%)", border: "1px solid rgba(170,160,255,0.45)" },
    otherBubble: { background: "linear-gradient(138deg, #242b4f 0%, #1a213f 100%)", border: "1px solid rgba(140,148,204,0.28)" },
    replyPreview: { borderLeft: "3px solid rgba(255,255,255,0.55)", paddingLeft: 8, marginBottom: 5 },
    replyAuthor: { fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.92)" },
    replyText: { fontSize: "0.78rem", color: "rgba(255,255,255,0.78)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 340 },
    editWrap: { width: "100%", borderRadius: 12, border: "1px solid rgba(140,148,204,0.3)", background: "rgba(20,26,47,0.75)", padding: 8 },
    editInput: { background: "#12182e", border: "1px solid #6352f0", borderRadius: 10, padding: "0.52rem 0.65rem", color: "#fff" },
    editActions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 },
    inputArea: { borderTop: "1px solid rgba(140,148,204,0.2)", padding: "0.7rem 0.9rem", display: "flex", flexDirection: "column", gap: 6 },
    replyComposer: { display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid rgba(140,148,204,0.26)", background: "rgba(18,24,45,0.65)", borderRadius: 10, padding: "0.45rem 0.6rem" },
    replyComposerTitle: { fontSize: "0.73rem", fontWeight: 700, color: "#c7ccff" },
    replyComposerText: { fontSize: "0.78rem", color: "var(--text-muted)", maxWidth: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    typing: { fontSize: "0.74rem", color: "#c0c6f6", marginLeft: 5 },
    inputRow: { display: "flex", alignItems: "center", gap: 8 },
    toolBtn: { minWidth: 34, height: 34, borderRadius: 10, border: "1px solid rgba(140,148,204,0.26)", background: "rgba(15,20,36,0.7)", color: "#b9c0f7", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 11, fontWeight: 700 },
    input: { flex: 1, background: "#11172b", border: "1px solid #2f3b66", borderRadius: 999, padding: "0.72rem 1rem", color: "#fff" },
    sendBtn: { width: 38, height: 38, border: "1px solid rgba(170,160,255,0.45)", borderRadius: 999, background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
    emojiWrap: { display: "flex", flexWrap: "wrap", gap: 6, border: "1px solid rgba(140,148,204,0.2)", background: "rgba(13,18,34,0.75)", borderRadius: 12, padding: 8 },
    emojiBtn: { width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(140,148,204,0.2)", background: "rgba(20,27,48,0.7)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
    center: { display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" },
};

