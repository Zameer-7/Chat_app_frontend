"use client";
import React from "react";

export default function NovaChatMark({ size = 32 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
                <linearGradient id="nova-grad" x1="16" y1="12" x2="112" y2="116" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#1E90FF" />
                    <stop offset="1" stopColor="#8A2BE2" />
                </linearGradient>
            </defs>
            <path
                d="M38 16H90C103.255 16 114 26.7452 114 40V73C114 86.2548 103.255 97 90 97H58L31 112V97H38C24.7452 97 14 86.2548 14 73V40C14 26.7452 24.7452 16 38 16Z"
                fill="url(#nova-grad)"
            />
            <path
                d="M44 42H86L53 86H86"
                stroke="white"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

