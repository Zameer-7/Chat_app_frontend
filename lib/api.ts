import axios from "axios";

const baseURL = process.env.NEXT_PUBLIC_API_URL || "https://chat-app-backend-kmr3.onrender.com";

const api = axios.create({
    baseURL,
});

api.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

export default api;
