"use client";

import dynamic from "next/dynamic";

const DynamicHistoryWithNoSSR = dynamic(() => import("@/components/podcast-mvp/history"), { ssr: false });

export default function ClientDynamicPodcastHistory() {
  return <DynamicHistoryWithNoSSR />;
}

