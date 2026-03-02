"use client";
import React, { useId } from "react";

export default function NovaChatMark({ size = 32 }: { size?: number }) {
    const gradId = useId();
    return (
        <svg width={size} height={size} viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
                <linearGradient id={gradId} x1="22" y1="16" x2="106" y2="112" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#1E90FF" />
                    <stop offset="1" stopColor="#8A2BE2" />
                </linearGradient>
            </defs>
            <path
                d="M28 102V26M28 26L100 102M100 102V26"
                stroke={`url(#${gradId})`}
                strokeWidth="14"
                strokeLinecap="square"
                strokeLinejoin="round"
            />
        </svg>
    );
}
