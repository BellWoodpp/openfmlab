"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export function UserAvatar({
  src,
  name,
  email,
  size,
  className,
}: {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size: number;
  className?: string;
}) {
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const isBroken = typeof src === "string" && src.length > 0 && brokenSrc === src;

  const initials = useMemo(() => {
    const raw = (name || email || "U").trim();
    if (!raw) return "U";
    return raw
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [email, name]);

  const textSizeClass = size >= 48 ? "text-lg" : size >= 40 ? "text-base" : "text-sm";

  if (src && !isBroken) {
    return (
      <Image
        src={src}
        alt={name || email || "User"}
        width={size}
        height={size}
        unoptimized
        className={cn("rounded-full object-cover", className)}
        onError={() => setBrokenSrc(src)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white font-semibold",
        textSizeClass,
        className,
      )}
      style={{ width: size, height: size }}
      aria-label={name || email || "User"}
    >
      {initials}
    </div>
  );
}
