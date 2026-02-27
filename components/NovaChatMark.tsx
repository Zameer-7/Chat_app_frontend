"use client";
import React, { useId } from "react";

export default function NovaChatMark({ size = 32 }: { size?: number }) {
    const gradId = useId();
    return (
        <svg width={size} height={size} viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
                <linearGradient id={gradId} x1="20" y1="18" x2="108" y2="106" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#1E90FF" />
                    <stop offset="1" stopColor="#8A2BE2" />
                </linearGradient>
            </defs>
            <path
                d="M24 94C30 94 34 89 34 81V37C34 30 39 25 46 25C53 25 58 30 58 37V61C58 69 62 75 70 75C78 75 82 69 82 61V37C82 30 87 25 94 25C101 25 106 30 106 37V91"
                stroke={`url(#${gradId})`}
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
