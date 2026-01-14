"use client";
import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Header } from "./ui/Header";
import { Waveform } from "./ui/Icons";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import dynamic from "next/dynamic";
import { Coins, Upload, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { useLocale } from "@/hooks";
import type { Locale } from "@/i18n";
import { useBodyScrollable } from "@/hooks/useBodyScrollable";
import { Block } from "./ui/Block";
import { Footer } from "./ui/Footer";
import { appStore } from "@/lib/store";
import { siteConfig } from "@/lib/site-config";
import { Skeleton } from "@/components/ui/skeleton";
import BrowserNotSupported from "./ui/BrowserNotSupported";
import PlayButton from "./PlayButton";
import { ShareButton } from "./ShareButton";
import { VoiceCloningClient } from "@/components/voice-cloning-client";

type ViewType = 'tts' | 'cloning';
type CostEstimateData = {
  supported: boolean;
  billingTier: string;
  estimate?: {
    chars: number;
    freeRemainingChars: number;
    billableChars: number;
    estimatedCostHkd: number;
  };
  pricing?: { freeCharsPerMonth: number; hkdPer1MCharsOverFree: number };
  tokenEstimate?: { charsPerToken: number; baseTokens: number; multiplier: number; tokens: number };
  usageTracked?: boolean;
  month?: string;
};

type PodcastMvpUiCopy = {
  sidebarTextToSpeech: string;
  sidebarHistory: string;
  sidebarSupportTitle: string;
  blockTextToSpeech: string;
  blockSelectVoice: string;
  blockGeneratedHistory: string;
  historyBoardTitle: string;
  historyBoardRefresh: string;
  historyBoardNote: string;
  historyBoardSelectionSummary: string;
  historyBoardUsageSummary: string;
  historyBoardSelectAllAria: string;
  historyBoardColumnText: string;
  historyBoardColumnVoice: string;
  historyBoardColumnCreatedAt: string;
  historyBoardColumnAudio: string;
  historyBoardColumnActions: string;
  historyBoardRecordAudioLabel: string;
  historyDuration: string;
  historyLoading: string;
  historyDownload: string;
  historyDelete: string;
  historyConfirmDelete: string;
  historyClear: string;
  historyRetention: string;
  historyConfirmClearAll: string;
  inputPlaceholder: string;
  uploadFile: string;
  customTitleToggle: string;
  customTitlePlaceholder: string;
  clearText: string;
  generate: string;
  stop: string;
  noAudioYetStart: string;
  noAudioYetEnd: string;
  noHistoryYet: string;
  playback: string;
  playbackNote: string;
  speed: string;
  speedModeAuto: string;
  speedModeCustom: string;
  speedRateLabel: string;
  tone: string;
  toneOptions: {
    neutral: string;
    calm: string;
    serious: string;
    cheerful: string;
    excited: string;
    surprised: string;
  };
  volume: string;
  speakingRateWhyTitle: string;
  speakingRateWhyItems: string[];
  languageTip: string;
  toneHelpAria: string;
  toneHelpTitle: string;
  toneHelpDialogTitle: string;
  toneHelpDialogDescription: string;
  toneHelpClose: string;
  toneHelpItems: Array<{ label: string; description: string }>;
};

function formatTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
}

const PODCAST_MVP_UI_COPY: Partial<Record<Locale, Partial<PodcastMvpUiCopy>>> & { en: PodcastMvpUiCopy } = {
  en: {
    sidebarTextToSpeech: "Text to Speech",
    sidebarHistory: "History",
    sidebarSupportTitle: "If you have any questions, contact us",
    blockTextToSpeech: "Text to Speech",
    blockSelectVoice: "Select a voice",
    blockGeneratedHistory: "Generated History",
    historyBoardTitle: "Audio Generation History",
    historyBoardRefresh: "Refresh",
    historyBoardNote:
      "Note: Audio files are retained for {days} day(s), and only the latest {maxItems} items are kept.",
    historyBoardSelectionSummary: "{selected} of {pageItems} row(s) selected on this page. Total: {totalCount}.",
    historyBoardUsageSummary: "{usedItems}/{maxItems} · {usedBytes}/{maxBytes}",
    historyBoardSelectAllAria: "Select all",
    historyBoardColumnText: "Text",
    historyBoardColumnVoice: "Voice",
    historyBoardColumnCreatedAt: "Created At",
    historyBoardColumnAudio: "Audio",
    historyBoardColumnActions: "Actions",
    historyBoardRecordAudioLabel: "Record your audio",
    historyDuration: "Total duration:",
    historyLoading: "Loading…",
    historyDownload: "Download",
    historyDelete: "Delete",
    historyConfirmDelete: "Delete this audio?",
    historyClear: "Clear",
    historyRetention:
      "Auto retention: keep the latest {maxItems} items and only the last {maxDays} days. If exceeded, older items are deleted automatically. Storage quota: {maxTotalBytes}; if exceeded, generation is blocked until you delete.",
    historyConfirmClearAll: "Clear all generated history?",
    inputPlaceholder: "Enter text to generate speech…",
    uploadFile: "Upload File",
    customTitleToggle: "Custom name",
    customTitlePlaceholder: "Audio name (optional)",
    clearText: "Clear Text",
    generate: "Generate",
    stop: "Stop",
    noAudioYetStart: "No audio yet. Click ",
    noAudioYetEnd: " to create your first MP3.",
    noHistoryYet: "No history yet. {generate} audio from the {textToSpeech} page.",
    playback: "Playback",
    playbackNote: "Only affects playback speed (closer to a strict speed change). It does not regenerate audio and does not increase TTS usage.",
    speed: "Speed",
    speedModeAuto: "Auto",
    speedModeCustom: "Custom",
    speedRateLabel: "Rate",
    tone: "Tone",
    toneOptions: {
      neutral: "Neutral",
      calm: "Calm",
      serious: "Serious",
      cheerful: "Cheerful",
      excited: "Excited",
      surprised: "Surprised",
    },
    volume: "Volume",
    speakingRateWhyTitle: "Why might it not feel like 4x?",
    speakingRateWhyItems: [
      "It’s a relative speaking-rate / prosody target: Google re-synthesizes speech (it’s not simple time-stretching), and it may constrain changes for intelligibility and naturalness—so it won’t feel perfectly linear.",
      "Pauses don’t shrink proportionally: pauses from punctuation/line breaks and phrasing have some fixed cost, so even at higher speed the overall feel may be less than 4x.",
      "Different voices respond differently: especially voices like Chirp3‑HD (Despina), which can be more conservative at higher rates—so the perceived speed-up may be smaller than expected.",
      "If you want faster output, try using {playback} instead.",
    ],
    languageTip: "Tip: switching Language auto-picks a safe default; click a card to pin a voice for that language.",
    toneHelpAria: "Tone help",
    toneHelpTitle: "Tone help",
    toneHelpDialogTitle: "Tone guide",
    toneHelpDialogDescription:
      "Tone describes the style/emotion you want in the synthesized voice. Support varies by provider, but it’s used as a style prompt when generating.",
    toneHelpClose: "Close",
    toneHelpItems: [
      {
        label: "Neutral",
        description: "Neutral and natural; no deliberate emotion. Good for narration, explanations, and long-form reading.",
      },
      { label: "Calm", description: "Calmer, softer, and more relaxed. Good for tutorials, meditation, and easy storytelling." },
      { label: "Serious", description: "More formal and serious. Good for announcements, news, and rigorous content." },
      { label: "Cheerful", description: "Brighter and friendly. Good for greetings, marketing scripts, and light conversations." },
      { label: "Excited", description: "More energetic with emphasis. Good for openings, highlights, and promotions." },
      { label: "Surprised", description: "More ‘surprised/twist’ tone with stronger intonation. Good for twists, suspense, and punchlines." },
    ],
  },
  zh: {
    sidebarTextToSpeech: "文字转语音",
    sidebarHistory: "历史",
    sidebarSupportTitle: "如果有使用上的问题，联系我们",
    blockTextToSpeech: "文字转语音",
    blockSelectVoice: "选择声音",
    blockGeneratedHistory: "生成历史",
    historyBoardTitle: "音频生成历史",
    historyBoardRefresh: "刷新",
    historyBoardNote: "提示：音频将保留 {days} 天，仅保留最新 {maxItems} 条。",
    historyBoardSelectionSummary: "本页已选 {selected}/{pageItems} 条。总计：{totalCount}。",
    historyBoardUsageSummary: "{usedItems}/{maxItems} · {usedBytes}/{maxBytes}",
    historyBoardSelectAllAria: "全选",
    historyBoardColumnText: "文本",
    historyBoardColumnVoice: "音色",
    historyBoardColumnCreatedAt: "创建时间",
    historyBoardColumnAudio: "音频",
    historyBoardColumnActions: "操作",
    historyBoardRecordAudioLabel: "录制你的音频",
    historyDuration: "总时长：",
    historyLoading: "正在加载…",
    historyDownload: "下载",
    historyDelete: "删除",
    historyConfirmDelete: "确定删除这段音频吗？",
    historyClear: "清空",
    historyRetention:
      "自动保留：保留最近 {maxItems} 条，仅保留最近 {maxDays} 天。超过后更早的内容会自动删除。存储配额：{maxTotalBytes}；如果超出，在你删除前将无法继续生成。",
    historyConfirmClearAll: "确定清空所有生成历史吗？",
    inputPlaceholder: "输入文字以生成语音…",
    uploadFile: "上传文件",
    customTitleToggle: "自定义名称",
    customTitlePlaceholder: "语音名称（可选）",
    clearText: "清空文本",
    generate: "生成",
    stop: "停止",
    noAudioYetStart: "还没有音频。点击 ",
    noAudioYetEnd: " 来创建你的第一个 MP3。",
    noHistoryYet: "还没有历史记录。请在「{textToSpeech}」页 {generate} 音频。",
    playback: "播放倍速",
    playbackNote: "只影响播放倍速（更接近严格倍速），不会重新生成音频，也不会增加合成用量。",
    speed: "语速",
    speedModeAuto: "自动",
    speedModeCustom: "自定义",
    speedRateLabel: "倍率",
    tone: "语气",
    toneOptions: {
      neutral: "中性",
      calm: "平静",
      serious: "严肃",
      cheerful: "愉快",
      excited: "激动",
      surprised: "惊讶",
    },
    volume: "音量",
    speakingRateWhyTitle: "为什么体感可能不像 4x？",
    speakingRateWhyItems: [
      "它是“相对语速/韵律目标”：Google 会重新合成语音（不是把音频简单时间拉伸），为了可懂度/自然度会做限制，所以体感不一定线性。",
      "停顿不一定等比例缩短：句号/逗号/换行带来的停顿、强调、断句有一部分是“固定成本”，即使你提速，停顿可能缩得没那么多，整体听感就不像 4x。",
      "不同 voice 的响应差异很大：尤其像 Chirp3‑HD（Despina）这类，模型会更“稳”，提速更保守，实际提升幅度可能明显小于你预期。",
      "如果你想要更快的语速，可以改用上面的 {playback}。",
    ],
    languageTip: "提示：切换 Language 会自动选择一个安全默认音色；点击卡片可为该语言固定一个音色。",
    toneHelpAria: "Tone 说明",
    toneHelpTitle: "Tone 说明",
    toneHelpDialogTitle: "Tone 说明",
    toneHelpDialogDescription:
      "Tone 用来描述你希望合成语音呈现的语气/情绪。不同提供商对 Tone 的支持强度不同，但它会作为风格提示用于生成。",
    toneHelpClose: "关闭",
    toneHelpItems: [
      { label: "中性", description: "中性自然，不刻意表达情绪，适合旁白/说明/长文朗读。" },
      { label: "平静", description: "更平静克制、柔和放松，适合教程/冥想/轻松叙述。" },
      { label: "严肃", description: "更正式严肃、语气更稳，适合公告/新闻/严谨内容。" },
      { label: "愉快", description: "更明亮友好、带笑意，适合欢迎语/营销口播/轻松对话。" },
      { label: "激动", description: "更有能量、强调重点，适合开场/高潮段落/促销信息。" },
      { label: "惊讶", description: "更“惊讶/反转”语气、起伏更明显，适合剧情转折/悬念/有梗的句子。" },
    ],
  },
  ja: {
    sidebarTextToSpeech: "テキスト読み上げ",
    sidebarHistory: "履歴",
    sidebarSupportTitle: "ご不明点があればご連絡ください",
    blockTextToSpeech: "テキスト読み上げ",
    blockSelectVoice: "音声を選択",
    blockGeneratedHistory: "生成履歴",
    historyBoardTitle: "音声生成履歴",
    historyBoardRefresh: "更新",
    historyBoardNote: "注：音声ファイルは {days} 日間保持され、最新 {maxItems} 件のみが保持されます。",
    historyBoardSelectionSummary: "このページで {pageItems} 行中 {selected} 行を選択。合計：{totalCount}。",
    historyBoardUsageSummary: "{usedItems}/{maxItems} · {usedBytes}/{maxBytes}",
    historyBoardSelectAllAria: "すべて選択",
    historyBoardColumnText: "テキスト",
    historyBoardColumnVoice: "音声",
    historyBoardColumnCreatedAt: "作成日時",
    historyBoardColumnAudio: "音声",
    historyBoardColumnActions: "操作",
    historyBoardRecordAudioLabel: "音声を録音",
    historyDuration: "合計時間：",
    historyLoading: "読み込み中…",
    historyDownload: "ダウンロード",
    historyDelete: "削除",
    historyConfirmDelete: "この音声を削除しますか？",
    historyClear: "クリア",
    historyRetention:
      "自動保持：最新 {maxItems} 件まで、直近 {maxDays} 日のみ保持します。超えると古い項目は自動的に削除されます。保存容量：{maxTotalBytes}。超えると削除するまで生成できません。",
    historyConfirmClearAll: "生成履歴をすべてクリアしますか？",
    inputPlaceholder: "テキストを入力して音声を生成…",
    uploadFile: "ファイルをアップロード",
    customTitleToggle: "カスタム名",
    customTitlePlaceholder: "音声名（任意）",
    clearText: "テキストをクリア",
    generate: "生成",
    stop: "停止",
    noAudioYetStart: "まだ音声がありません。",
    noAudioYetEnd: " をクリックして最初の MP3 を作成してください。",
    noHistoryYet: "履歴はまだありません。「{textToSpeech}」ページで {generate} してください。",
    playback: "再生速度",
    playbackNote: "再生速度にのみ影響します（厳密な速度変更に近い）。音声の再生成は行わず、合成の使用量も増えません。",
    speed: "話速",
    speedModeAuto: "自動",
    speedModeCustom: "カスタム",
    speedRateLabel: "倍率",
    tone: "トーン",
    toneOptions: {
      neutral: "ニュートラル",
      calm: "落ち着いた",
      serious: "真剣",
      cheerful: "明るい",
      excited: "興奮",
      surprised: "驚き",
    },
    volume: "音量",
    speakingRateWhyTitle: "体感が 4x にならないことがある理由",
    speakingRateWhyItems: [
      "これは相対的な話速/韻律の目標です：Google は音声を再合成します（単純な時間伸縮ではありません）。可読性/自然さのために制限が入るため、体感が線形にならないことがあります。",
      "間（ポーズ）は比例して短くならないことがあります：句読点や改行による間、強調や区切りには固定コストがあり、速度を上げても間が十分に縮まらず、全体として 4x に感じにくいです。",
      "音声ごとの反応差が大きいです：特に Chirp3‑HD（Despina）のような音声は高い話速でより保守的になり、体感の上昇幅が想定より小さいことがあります。",
      "より速くしたい場合は、上の {playback} を試してください。",
    ],
    languageTip:
      "ヒント：Language を切り替えると安全なデフォルト音声が自動選択されます。カードをクリックすると、その言語に音声を固定できます。",
    toneHelpAria: "トーンのヘルプ",
    toneHelpTitle: "トーンのヘルプ",
    toneHelpDialogTitle: "トーンについて",
    toneHelpDialogDescription:
      "Tone は、合成音声にどんな話し方/感情を持たせたいかを表します。対応度はプロバイダーによって異なりますが、生成時のスタイル指示として使われます。",
    toneHelpClose: "閉じる",
    toneHelpItems: [
      { label: "ニュートラル", description: "中立で自然。強い感情表現はしない。ナレーション、説明、長文読み上げ向き。" },
      { label: "落ち着いた", description: "落ち着いて柔らかい。チュートリアル、瞑想、穏やかな語り向き。" },
      { label: "真剣", description: "よりフォーマルで真面目。告知、ニュース、堅い内容向き。" },
      { label: "明るい", description: "明るくフレンドリー。挨拶、マーケ音声、軽い会話向き。" },
      { label: "興奮", description: "エネルギッシュで強調が増える。冒頭、盛り上げ、プロモ向き。" },
      { label: "驚き", description: "驚き/反転のニュアンス。抑揚が強め。展開の転換、サスペンス、オチ向き。" },
    ],
  },
  es: {
    sidebarTextToSpeech: "Texto a voz",
    sidebarHistory: "Historial",
    sidebarSupportTitle: "Si tienes preguntas, contáctanos",
    blockTextToSpeech: "Texto a voz",
    blockSelectVoice: "Selecciona una voz",
    blockGeneratedHistory: "Historial generado",
    historyBoardTitle: "Historial de generación de audio",
    historyBoardRefresh: "Actualizar",
    historyBoardNote:
      "Nota: Los audios se conservan durante {days} día(s) y solo se guardan los últimos {maxItems} elementos.",
    historyBoardSelectionSummary:
      "{selected} de {pageItems} fila(s) seleccionada(s) en esta página. Total: {totalCount}.",
    historyBoardUsageSummary: "{usedItems}/{maxItems} · {usedBytes}/{maxBytes}",
    historyBoardSelectAllAria: "Seleccionar todo",
    historyBoardColumnText: "Texto",
    historyBoardColumnVoice: "Voz",
    historyBoardColumnCreatedAt: "Creado el",
    historyBoardColumnAudio: "Audio",
    historyBoardColumnActions: "Acciones",
    historyBoardRecordAudioLabel: "Graba tu audio",
    historyDuration: "Duración total:",
    historyLoading: "Cargando…",
    historyDownload: "Descargar",
    historyDelete: "Eliminar",
    historyConfirmDelete: "¿Eliminar este audio?",
    historyClear: "Borrar",
    historyRetention:
      "Retención automática: conserva los últimos {maxItems} elementos y solo los últimos {maxDays} días. Si se supera, los más antiguos se eliminan automáticamente. Cuota de almacenamiento: {maxTotalBytes}; si se supera, la generación se bloqueará hasta que elimines.",
    historyConfirmClearAll: "¿Borrar todo el historial generado?",
    inputPlaceholder: "Introduce texto para generar voz…",
    uploadFile: "Subir archivo",
    customTitleToggle: "Nombre personalizado",
    customTitlePlaceholder: "Nombre del audio (opcional)",
    clearText: "Borrar texto",
    generate: "Generar",
    stop: "Detener",
    noAudioYetStart: "Aún no hay audio. Haz clic en ",
    noAudioYetEnd: " para crear tu primer MP3.",
    noHistoryYet: "Aún no hay historial. {generate} audio desde la página {textToSpeech}.",
    playback: "Reproducción",
    playbackNote: "Solo afecta a la velocidad de reproducción (más parecido a un cambio estricto). No regenera el audio ni aumenta el uso de síntesis.",
    speed: "Velocidad",
    speedModeAuto: "Automático",
    speedModeCustom: "Personalizado",
    speedRateLabel: "Tasa",
    tone: "Tono",
    toneOptions: {
      neutral: "Neutro",
      calm: "Calmado",
      serious: "Serio",
      cheerful: "Alegre",
      excited: "Emocionado",
      surprised: "Sorprendido",
    },
    volume: "Volumen",
    speakingRateWhyTitle: "¿Por qué puede que no se sienta como 4x?",
    speakingRateWhyItems: [
      "Es un objetivo relativo de velocidad/prosodia: Google vuelve a sintetizar el audio (no es un simple estiramiento temporal) y puede limitar los cambios por claridad y naturalidad; por eso no siempre se siente lineal.",
      "Las pausas no se reducen proporcionalmente: la puntuación, saltos de línea y la fraseología tienen un coste fijo, así que el resultado puede sentirse menos que 4x.",
      "Cada voz reacciona distinto: especialmente voces como Chirp3‑HD (Despina) pueden ser más conservadoras a altas velocidades, y el aumento percibido puede ser menor de lo esperado.",
      "Si quieres más rapidez, prueba {playback}.",
    ],
    languageTip:
      "Consejo: al cambiar el idioma se elige automáticamente una voz segura; haz clic en una tarjeta para fijar una voz para ese idioma.",
    toneHelpAria: "Ayuda de tono",
    toneHelpTitle: "Ayuda de tono",
    toneHelpDialogTitle: "Guía de tono",
    toneHelpDialogDescription:
      "El tono describe el estilo/emoción que quieres en la voz sintetizada. El soporte varía según el proveedor, pero se usa como indicación de estilo al generar.",
    toneHelpClose: "Cerrar",
    toneHelpItems: [
      { label: "Neutro", description: "Neutral y natural; sin emoción marcada. Ideal para narración, explicaciones y lecturas largas." },
      { label: "Calmado", description: "Más calmado, suave y relajado. Ideal para tutoriales, meditación y relatos tranquilos." },
      { label: "Serio", description: "Más formal y serio. Ideal para anuncios, noticias y contenido riguroso." },
      { label: "Alegre", description: "Más brillante y amistoso. Ideal para saludos, marketing y conversaciones ligeras." },
      { label: "Emocionado", description: "Más enérgico con énfasis. Ideal para aperturas, momentos destacados y promociones." },
      { label: "Sorprendido", description: "Tono de sorpresa/giro con más entonación. Ideal para giros, suspense y remates." },
    ],
  },
  ar: {
    sidebarTextToSpeech: "تحويل النص إلى كلام",
    sidebarHistory: "السجل",
    sidebarSupportTitle: "إذا كانت لديك أي أسئلة، تواصل معنا",
    blockTextToSpeech: "تحويل النص إلى كلام",
    blockSelectVoice: "اختر صوتًا",
    blockGeneratedHistory: "سجل الإنشاء",
    historyBoardTitle: "سجل إنشاء الصوت",
    historyBoardRefresh: "تحديث",
    historyBoardNote: "ملاحظة: يتم الاحتفاظ بالملفات الصوتية لمدة {days} يومًا، ويتم حفظ أحدث {maxItems} عنصرًا فقط.",
    historyBoardSelectionSummary: "تم تحديد {selected} من أصل {pageItems} صف/صفوف في هذه الصفحة. الإجمالي: {totalCount}.",
    historyBoardUsageSummary: "{usedItems}/{maxItems} · {usedBytes}/{maxBytes}",
    historyBoardSelectAllAria: "تحديد الكل",
    historyBoardColumnText: "النص",
    historyBoardColumnVoice: "الصوت",
    historyBoardColumnCreatedAt: "تاريخ الإنشاء",
    historyBoardColumnAudio: "الصوت",
    historyBoardColumnActions: "إجراءات",
    historyBoardRecordAudioLabel: "سجّل صوتك",
    historyDuration: "المدة الإجمالية:",
    historyLoading: "جارٍ التحميل…",
    historyDownload: "تنزيل",
    historyDelete: "حذف",
    historyConfirmDelete: "هل تريد حذف هذا الصوت؟",
    historyClear: "مسح",
    historyRetention:
      "الاحتفاظ التلقائي: نحتفظ بآخر {maxItems} عنصرًا وآخر {maxDays} أيام فقط. عند تجاوز الحد تُحذف العناصر الأقدم تلقائيًا. حصة التخزين: {maxTotalBytes}؛ عند تجاوزها سيتم حظر الإنشاء حتى تقوم بالحذف.",
    historyConfirmClearAll: "هل تريد مسح سجل الإنشاء بالكامل؟",
    inputPlaceholder: "أدخل نصًا لإنشاء الصوت…",
    uploadFile: "رفع ملف",
    customTitleToggle: "اسم مخصص",
    customTitlePlaceholder: "اسم الصوت (اختياري)",
    clearText: "مسح النص",
    generate: "توليد",
    stop: "إيقاف",
    noAudioYetStart: "لا يوجد صوت بعد. انقر على ",
    noAudioYetEnd: " لإنشاء أول ملف MP3.",
    noHistoryYet: "لا يوجد سجل بعد. {generate} الصوت من صفحة {textToSpeech}.",
    playback: "التشغيل",
    playbackNote: "يؤثر فقط على سرعة التشغيل (أقرب لتغيير صارم للسرعة). لا يعيد توليد الصوت ولا يزيد من استهلاك التحويل إلى كلام.",
    speed: "السرعة",
    speedModeAuto: "تلقائي",
    speedModeCustom: "مخصص",
    speedRateLabel: "المعدل",
    tone: "النبرة",
    toneOptions: {
      neutral: "محايد",
      calm: "هادئ",
      serious: "جاد",
      cheerful: "مبتهج",
      excited: "متحمس",
      surprised: "متفاجئ",
    },
    volume: "مستوى الصوت",
    speakingRateWhyTitle: "لماذا قد لا تشعر بأنها 4x؟",
    speakingRateWhyItems: [
      "هذا هدف نسبي لسرعة الكلام/الإيقاع: تقوم Google بإعادة تركيب الصوت (وليس مجرد تمديد زمني بسيط)، وقد تقيّد التغييرات للحفاظ على الوضوح والطبيعية، لذا قد لا يكون الإحساس خطيًا.",
      "الوقفات قد لا تقصر بنسبة مماثلة: علامات الترقيم وفواصل الأسطر وطريقة النطق لها كلفة ثابتة، لذلك قد يبدو الناتج أقل من 4x.",
      "تختلف الاستجابة حسب الصوت: خاصة أصوات مثل Chirp3‑HD (Despina) قد تكون أكثر تحفظًا عند السرعات العالية، فيكون التسريع المُحسوس أقل مما تتوقع.",
      "إذا أردت سرعة أكبر، جرّب {playback}.",
    ],
    languageTip:
      "نصيحة: عند تبديل اللغة يتم اختيار صوت افتراضي آمن تلقائيًا؛ انقر على بطاقة لتثبيت صوت لتلك اللغة.",
    toneHelpAria: "مساعدة النبرة",
    toneHelpTitle: "مساعدة النبرة",
    toneHelpDialogTitle: "دليل النبرة",
    toneHelpDialogDescription:
      "النبرة تصف الأسلوب/المشاعر التي تريدها في الصوت المُركّب. يختلف الدعم حسب المزوّد، لكنها تُستخدم كتلميح أسلوبي أثناء التوليد.",
    toneHelpClose: "إغلاق",
    toneHelpItems: [
      { label: "محايد", description: "محايد وطبيعي دون عاطفة واضحة. مناسب للسرد والشرح والقراءة الطويلة." },
      { label: "هادئ", description: "أكثر هدوءًا ونعومة واسترخاءً. مناسب للدروس والتأمل والسرد الهادئ." },
      { label: "جاد", description: "أكثر رسمية وجدية. مناسب للإعلانات والأخبار والمحتوى الدقيق." },
      { label: "مبتهج", description: "أكثر إشراقًا وودّية. مناسب للتحيات ونصوص التسويق والمحادثات الخفيفة." },
      { label: "متحمس", description: "أكثر حيوية مع إبراز النقاط. مناسب للمقدمات واللحظات المهمة والعروض." },
      { label: "متفاجئ", description: "نبرة مفاجأة/تحوّل مع تنغيم أقوى. مناسبة للانعطافات والتشويق والنهايات الطريفة." },
    ],
  },
  id: {
    sidebarTextToSpeech: "Teks ke suara",
    sidebarHistory: "Riwayat",
    sidebarSupportTitle: "Jika ada pertanyaan, hubungi kami",
    blockTextToSpeech: "Teks ke suara",
    blockSelectVoice: "Pilih suara",
    blockGeneratedHistory: "Riwayat hasil",
    historyBoardTitle: "Riwayat pembuatan audio",
    historyBoardRefresh: "Muat ulang",
    historyBoardNote:
      "Catatan: File audio disimpan selama {days} hari dan hanya {maxItems} item terbaru yang dipertahankan.",
    historyBoardSelectionSummary: "{selected} dari {pageItems} baris dipilih di halaman ini. Total: {totalCount}.",
    historyBoardUsageSummary: "{usedItems}/{maxItems} · {usedBytes}/{maxBytes}",
    historyBoardSelectAllAria: "Pilih semua",
    historyBoardColumnText: "Teks",
    historyBoardColumnVoice: "Suara",
    historyBoardColumnCreatedAt: "Dibuat",
    historyBoardColumnAudio: "Audio",
    historyBoardColumnActions: "Aksi",
    historyBoardRecordAudioLabel: "Rekam audio kamu",
    historyDuration: "Durasi total:",
    historyLoading: "Memuat…",
    historyDownload: "Unduh",
    historyDelete: "Hapus",
    historyConfirmDelete: "Hapus audio ini?",
    historyClear: "Hapus",
    historyRetention:
      "Retensi otomatis: simpan {maxItems} item terbaru dan hanya {maxDays} hari terakhir. Jika terlampaui, item lama akan dihapus otomatis. Kuota penyimpanan: {maxTotalBytes}; jika terlampaui, pembuatan akan diblokir sampai kamu menghapus.",
    historyConfirmClearAll: "Hapus semua riwayat hasil?",
    inputPlaceholder: "Masukkan teks untuk membuat suara…",
    uploadFile: "Unggah file",
    customTitleToggle: "Nama kustom",
    customTitlePlaceholder: "Nama audio (opsional)",
    clearText: "Hapus teks",
    generate: "Buat",
    stop: "Berhenti",
    noAudioYetStart: "Belum ada audio. Klik ",
    noAudioYetEnd: " untuk membuat MP3 pertamamu.",
    noHistoryYet: "Belum ada riwayat. {generate} audio dari halaman {textToSpeech}.",
    playback: "Pemutaran",
    playbackNote: "Hanya memengaruhi kecepatan pemutaran (lebih mendekati perubahan kecepatan yang ketat). Tidak membuat ulang audio dan tidak menambah pemakaian TTS.",
    speed: "Kecepatan",
    speedModeAuto: "Otomatis",
    speedModeCustom: "Kustom",
    speedRateLabel: "Laju",
    tone: "Nada",
    toneOptions: {
      neutral: "Netral",
      calm: "Tenang",
      serious: "Serius",
      cheerful: "Ceria",
      excited: "Bersemangat",
      surprised: "Terkejut",
    },
    volume: "Volume",
    speakingRateWhyTitle: "Kenapa rasanya bisa tidak seperti 4x?",
    speakingRateWhyItems: [
      "Ini target relatif untuk kecepatan/prosodi: Google menyintesis ulang (bukan sekadar time-stretch) dan bisa membatasi perubahan demi kejelasan dan naturalitas—jadi terasa tidak selalu linear.",
      "Jeda tidak selalu memendek secara proporsional: jeda dari tanda baca/baris baru dan pemenggalan punya biaya tetap, jadi hasilnya bisa terasa kurang dari 4x.",
      "Respons tiap voice berbeda: terutama voice seperti Chirp3‑HD (Despina) bisa lebih konservatif pada kecepatan tinggi, sehingga peningkatan yang terasa lebih kecil dari ekspektasi.",
      "Kalau ingin lebih cepat, coba {playback}.",
    ],
    languageTip:
      "Tip: mengganti bahasa akan otomatis memilih suara default yang aman; klik kartu untuk menyematkan suara untuk bahasa tersebut.",
    toneHelpAria: "Bantuan nada",
    toneHelpTitle: "Bantuan nada",
    toneHelpDialogTitle: "Panduan nada",
    toneHelpDialogDescription:
      "Nada menggambarkan gaya/emosi yang kamu inginkan pada suara hasil sintesis. Dukungan tiap penyedia berbeda, namun digunakan sebagai petunjuk gaya saat generasi.",
    toneHelpClose: "Tutup",
    toneHelpItems: [
      { label: "Netral", description: "Netral dan natural; tanpa emosi yang menonjol. Cocok untuk narasi, penjelasan, dan bacaan panjang." },
      { label: "Tenang", description: "Lebih tenang, lembut, dan rileks. Cocok untuk tutorial, meditasi, dan cerita santai." },
      { label: "Serius", description: "Lebih formal dan serius. Cocok untuk pengumuman, berita, dan konten yang ketat." },
      { label: "Ceria", description: "Lebih cerah dan ramah. Cocok untuk sapaan, skrip marketing, dan percakapan ringan." },
      { label: "Bersemangat", description: "Lebih berenergi dengan penekanan. Cocok untuk pembuka, highlight, dan promosi." },
      { label: "Terkejut", description: "Nuansa ‘terkejut/plot twist’ dengan intonasi lebih kuat. Cocok untuk twist, suspense, dan punchline." },
    ],
  },
  pt: {
    sidebarTextToSpeech: "Texto para fala",
    sidebarHistory: "Histórico",
    sidebarSupportTitle: "Se tiver dúvidas, fale com a gente",
    blockTextToSpeech: "Texto para fala",
    blockSelectVoice: "Selecione uma voz",
    blockGeneratedHistory: "Histórico gerado",
    historyBoardTitle: "Histórico de geração de áudio",
    historyBoardRefresh: "Atualizar",
    historyBoardNote:
      "Nota: Os áudios são mantidos por {days} dia(s) e apenas os {maxItems} itens mais recentes são preservados.",
    historyBoardSelectionSummary: "{selected} de {pageItems} linha(s) selecionada(s) nesta página. Total: {totalCount}.",
    historyBoardUsageSummary: "{usedItems}/{maxItems} · {usedBytes}/{maxBytes}",
    historyBoardSelectAllAria: "Selecionar tudo",
    historyBoardColumnText: "Texto",
    historyBoardColumnVoice: "Voz",
    historyBoardColumnCreatedAt: "Criado em",
    historyBoardColumnAudio: "Áudio",
    historyBoardColumnActions: "Ações",
    historyBoardRecordAudioLabel: "Grave seu áudio",
    historyDuration: "Duração total:",
    historyLoading: "Carregando…",
    historyDownload: "Baixar",
    historyDelete: "Excluir",
    historyConfirmDelete: "Excluir este áudio?",
    historyClear: "Limpar",
    historyRetention:
      "Retenção automática: mantém os {maxItems} itens mais recentes e apenas os últimos {maxDays} dias. Se exceder, os mais antigos são excluídos automaticamente. Cota de armazenamento: {maxTotalBytes}; se exceder, a geração ficará bloqueada até você excluir.",
    historyConfirmClearAll: "Limpar todo o histórico gerado?",
    inputPlaceholder: "Digite o texto para gerar voz…",
    uploadFile: "Enviar arquivo",
    customTitleToggle: "Nome personalizado",
    customTitlePlaceholder: "Nome do áudio (opcional)",
    clearText: "Limpar texto",
    generate: "Gerar",
    stop: "Parar",
    noAudioYetStart: "Ainda não há áudio. Clique em ",
    noAudioYetEnd: " para criar seu primeiro MP3.",
    noHistoryYet: "Ainda não há histórico. {generate} áudio a partir da página {textToSpeech}.",
    playback: "Reprodução",
    playbackNote: "Afeta apenas a velocidade de reprodução (mais próximo de uma mudança estrita). Não regenera o áudio e não aumenta o uso de síntese.",
    speed: "Velocidade",
    speedModeAuto: "Automático",
    speedModeCustom: "Personalizado",
    speedRateLabel: "Taxa",
    tone: "Tom",
    toneOptions: {
      neutral: "Neutro",
      calm: "Calmo",
      serious: "Sério",
      cheerful: "Alegre",
      excited: "Animado",
      surprised: "Surpreso",
    },
    volume: "Volume",
    speakingRateWhyTitle: "Por que pode não parecer 4x?",
    speakingRateWhyItems: [
      "É um alvo relativo de fala/prosódia: o Google re-sintetiza a voz (não é apenas esticar o tempo) e pode limitar mudanças para manter inteligibilidade e naturalidade—por isso pode não ser linear.",
      "As pausas não diminuem proporcionalmente: pontuação/quebras de linha e a segmentação têm custo fixo, então o resultado pode parecer menos que 4x.",
      "Cada voice reage diferente: especialmente vozes como Chirp3‑HD (Despina) podem ser mais conservadoras em velocidades altas, e o ganho percebido pode ser menor que o esperado.",
      "Se quiser mais rápido, experimente {playback}.",
    ],
    languageTip:
      "Dica: ao trocar o idioma, uma voz segura é escolhida automaticamente; clique em um cartão para fixar uma voz para esse idioma.",
    toneHelpAria: "Ajuda de tom",
    toneHelpTitle: "Ajuda de tom",
    toneHelpDialogTitle: "Guia de tom",
    toneHelpDialogDescription:
      "O tom descreve o estilo/emoção que você quer na voz sintetizada. O suporte varia por provedor, mas ele é usado como uma dica de estilo na geração.",
    toneHelpClose: "Fechar",
    toneHelpItems: [
      { label: "Neutro", description: "Neutro e natural; sem emoção marcada. Bom para narração, explicações e leitura longa." },
      { label: "Calmo", description: "Mais calmo, suave e relaxado. Bom para tutoriais, meditação e histórias leves." },
      { label: "Sério", description: "Mais formal e sério. Bom para anúncios, notícias e conteúdo rigoroso." },
      { label: "Alegre", description: "Mais alegre e amigável. Bom para saudações, marketing e conversas leves." },
      { label: "Animado", description: "Mais enérgico, com ênfase. Bom para aberturas, destaques e promoções." },
      { label: "Surpreso", description: "Tom de ‘surpresa/virada’ com entonação mais forte. Bom para reviravoltas, suspense e punchlines." },
    ],
  },
  fr: {
    sidebarTextToSpeech: "Texte en parole",
    sidebarHistory: "Historique",
    sidebarSupportTitle: "Si vous avez des questions, contactez-nous",
    blockTextToSpeech: "Texte en parole",
    blockSelectVoice: "Choisir une voix",
    blockGeneratedHistory: "Historique généré",
    historyBoardTitle: "Historique de génération audio",
    historyBoardRefresh: "Actualiser",
    historyBoardNote:
      "Note : les fichiers audio sont conservés pendant {days} jour(s) et seuls les {maxItems} éléments les plus récents sont gardés.",
    historyBoardSelectionSummary: "{selected} sur {pageItems} ligne(s) sélectionnée(s) sur cette page. Total : {totalCount}.",
    historyBoardUsageSummary: "{usedItems}/{maxItems} · {usedBytes}/{maxBytes}",
    historyBoardSelectAllAria: "Tout sélectionner",
    historyBoardColumnText: "Texte",
    historyBoardColumnVoice: "Voix",
    historyBoardColumnCreatedAt: "Créé le",
    historyBoardColumnAudio: "Audio",
    historyBoardColumnActions: "Actions",
    historyBoardRecordAudioLabel: "Enregistrez votre audio",
    historyDuration: "Durée totale :",
    historyLoading: "Chargement…",
    historyDownload: "Télécharger",
    historyDelete: "Supprimer",
    historyConfirmDelete: "Supprimer cet audio ?",
    historyClear: "Effacer",
    historyRetention:
      "Rétention automatique : conserve les {maxItems} derniers éléments et uniquement les {maxDays} derniers jours. En cas de dépassement, les plus anciens sont supprimés automatiquement. Quota de stockage : {maxTotalBytes} ; en cas de dépassement, la génération est bloquée jusqu’à suppression.",
    historyConfirmClearAll: "Effacer tout l’historique généré ?",
    inputPlaceholder: "Saisissez du texte pour générer une voix…",
    uploadFile: "Importer un fichier",
    customTitleToggle: "Nom personnalisé",
    customTitlePlaceholder: "Nom de l’audio (optionnel)",
    clearText: "Effacer le texte",
    generate: "Générer",
    stop: "Arrêter",
    noAudioYetStart: "Pas d’audio pour l’instant. Cliquez sur ",
    noAudioYetEnd: " pour créer votre premier MP3.",
    noHistoryYet: "Pas encore d’historique. {generate} l’audio depuis la page {textToSpeech}.",
    playback: "Lecture",
    playbackNote: "N’affecte que la vitesse de lecture (plus proche d’un changement strict). Ne régénère pas l’audio et n’augmente pas l’utilisation de synthèse.",
    speed: "Vitesse",
    speedModeAuto: "Auto",
    speedModeCustom: "Personnalisé",
    speedRateLabel: "Taux",
    tone: "Ton",
    toneOptions: {
      neutral: "Neutre",
      calm: "Calme",
      serious: "Sérieux",
      cheerful: "Joyeux",
      excited: "Enthousiaste",
      surprised: "Surpris",
    },
    volume: "Volume",
    speakingRateWhyTitle: "Pourquoi cela peut ne pas sembler être du 4x ?",
    speakingRateWhyItems: [
      "C’est une cible relative de débit/prosodie : Google re-synthétise la voix (ce n’est pas un simple étirement temporel) et peut limiter les changements pour préserver l’intelligibilité et le naturel—donc ce n’est pas parfaitement linéaire.",
      "Les pauses ne se réduisent pas proportionnellement : la ponctuation/les retours à la ligne et le phrasé ont un coût fixe, donc le rendu peut sembler inférieur à 4x.",
      "Les voix réagissent différemment : surtout des voix comme Chirp3‑HD (Despina) peuvent être plus conservatrices à haut débit, et le gain perçu peut être plus faible que prévu.",
      "Si vous voulez plus rapide, essayez {playback}.",
    ],
    languageTip:
      "Astuce : changer de langue sélectionne automatiquement une voix sûre ; cliquez sur une carte pour épingler une voix pour cette langue.",
    toneHelpAria: "Aide sur le ton",
    toneHelpTitle: "Aide sur le ton",
    toneHelpDialogTitle: "Guide du ton",
    toneHelpDialogDescription:
      "Le ton décrit le style/l’émotion souhaité(e) pour la voix synthétisée. Le support varie selon le fournisseur, mais il sert d’indication de style lors de la génération.",
    toneHelpClose: "Fermer",
    toneHelpItems: [
      { label: "Neutre", description: "Neutre et naturel ; sans émotion marquée. Idéal pour narration, explications et lecture longue." },
      { label: "Calme", description: "Plus calme, doux et détendu. Idéal pour tutoriels, méditation et récits posés." },
      { label: "Sérieux", description: "Plus formel et sérieux. Idéal pour annonces, actualités et contenu rigoureux." },
      { label: "Joyeux", description: "Plus lumineux et amical. Idéal pour salutations, scripts marketing et conversations légères." },
      { label: "Enthousiaste", description: "Plus énergique avec davantage d’emphase. Idéal pour ouvertures, temps forts et promotions." },
      { label: "Surpris", description: "Ton ‘surpris/retournement’ avec intonation plus marquée. Idéal pour twists, suspense et chutes." },
    ],
  },
  ru: {
    sidebarTextToSpeech: "Текст в речь",
    sidebarHistory: "История",
    sidebarSupportTitle: "Если есть вопросы — свяжитесь с нами",
    blockTextToSpeech: "Текст в речь",
    blockSelectVoice: "Выберите голос",
    blockGeneratedHistory: "История генераций",
    historyBoardTitle: "История генерации аудио",
    historyBoardRefresh: "Обновить",
    historyBoardNote: "Примечание: аудиофайлы хранятся {days} дн., и сохраняются только последние {maxItems} элементов.",
    historyBoardSelectionSummary: "Выбрано {selected} из {pageItems} строк на этой странице. Всего: {totalCount}.",
    historyBoardUsageSummary: "{usedItems}/{maxItems} · {usedBytes}/{maxBytes}",
    historyBoardSelectAllAria: "Выбрать всё",
    historyBoardColumnText: "Текст",
    historyBoardColumnVoice: "Голос",
    historyBoardColumnCreatedAt: "Создано",
    historyBoardColumnAudio: "Аудио",
    historyBoardColumnActions: "Действия",
    historyBoardRecordAudioLabel: "Запишите ваше аудио",
    historyDuration: "Общая длительность:",
    historyLoading: "Загрузка…",
    historyDownload: "Скачать",
    historyDelete: "Удалить",
    historyConfirmDelete: "Удалить это аудио?",
    historyClear: "Очистить",
    historyRetention:
      "Автохранение: сохраняем последние {maxItems} записей и только за последние {maxDays} дней. При превышении старые записи удаляются автоматически. Квота хранилища: {maxTotalBytes}; при превышении генерация блокируется, пока вы не удалите.",
    historyConfirmClearAll: "Очистить всю историю генераций?",
    inputPlaceholder: "Введите текст, чтобы сгенерировать речь…",
    uploadFile: "Загрузить файл",
    customTitleToggle: "Своё имя",
    customTitlePlaceholder: "Название аудио (необязательно)",
    clearText: "Очистить текст",
    generate: "Создать",
    stop: "Остановить",
    noAudioYetStart: "Пока нет аудио. Нажмите ",
    noAudioYetEnd: ", чтобы создать свой первый MP3.",
    noHistoryYet: "Истории пока нет. {generate} аудио на странице {textToSpeech}.",
    playback: "Воспроизведение",
    playbackNote: "Влияет только на скорость воспроизведения (ближе к строгому изменению скорости). Не пересоздаёт аудио и не увеличивает расход синтеза.",
    speed: "Скорость",
    speedModeAuto: "Авто",
    speedModeCustom: "Вручную",
    speedRateLabel: "Скорость",
    tone: "Тон",
    toneOptions: {
      neutral: "Нейтральный",
      calm: "Спокойный",
      serious: "Серьёзный",
      cheerful: "Весёлый",
      excited: "Воодушевлённый",
      surprised: "Удивлённый",
    },
    volume: "Громкость",
    speakingRateWhyTitle: "Почему может не ощущаться как 4x?",
    speakingRateWhyItems: [
      "Это относительная цель темпа/просодии: Google пересинтезирует речь (это не простое растяжение по времени) и может ограничивать изменения ради разборчивости и естественности—поэтому ощущение не всегда линейное.",
      "Паузы не сокращаются пропорционально: паузы из-за пунктуации/переносов строк и фразировки имеют фиксированную стоимость, поэтому итог может ощущаться меньше 4x.",
      "Разные голоса ведут себя по‑разному: особенно голоса вроде Chirp3‑HD (Despina) могут быть более консервативными на высоких темпах, и ощущаемое ускорение может быть меньше ожидаемого.",
      "Если нужно быстрее, попробуйте {playback}.",
    ],
    languageTip:
      "Совет: при смене языка автоматически выбирается безопасный голос по умолчанию; нажмите на карточку, чтобы закрепить голос для этого языка.",
    toneHelpAria: "Справка по тону",
    toneHelpTitle: "Справка по тону",
    toneHelpDialogTitle: "Руководство по тону",
    toneHelpDialogDescription:
      "Тон описывает стиль/эмоцию, которую вы хотите в синтезированной речи. Поддержка зависит от провайдера, но это используется как стилевой подсказчик при генерации.",
    toneHelpClose: "Закрыть",
    toneHelpItems: [
      { label: "Нейтральный", description: "Нейтрально и естественно, без выраженной эмоции. Подходит для озвучки, объяснений и длинных текстов." },
      { label: "Спокойный", description: "Более спокойный, мягкий и расслабленный. Подходит для туториалов, медитации и спокойного рассказа." },
      { label: "Серьёзный", description: "Более формально и серьёзно. Подходит для объявлений, новостей и строгого контента." },
      { label: "Весёлый", description: "Более ярко и дружелюбно. Подходит для приветствий, маркетинга и лёгких разговоров." },
      { label: "Воодушевлённый", description: "Больше энергии и акцентов. Подходит для вступлений, кульминаций и промо." },
      { label: "Удивлённый", description: "Интонация ‘удивление/поворот’ сильнее. Подходит для твистов, интриги и панчлайнов." },
    ],
  },
  de: {
    sidebarTextToSpeech: "Text zu Sprache",
    sidebarHistory: "Verlauf",
    sidebarSupportTitle: "Bei Fragen kontaktiere uns",
    blockTextToSpeech: "Text zu Sprache",
    blockSelectVoice: "Stimme auswählen",
    blockGeneratedHistory: "Generierte Historie",
    historyBoardTitle: "Audio-Generierungsverlauf",
    historyBoardRefresh: "Aktualisieren",
    historyBoardNote:
      "Hinweis: Audiodateien werden {days} Tag(e) aufbewahrt und es werden nur die neuesten {maxItems} Einträge behalten.",
    historyBoardSelectionSummary: "{selected} von {pageItems} Zeile(n) auf dieser Seite ausgewählt. Gesamt: {totalCount}.",
    historyBoardUsageSummary: "{usedItems}/{maxItems} · {usedBytes}/{maxBytes}",
    historyBoardSelectAllAria: "Alles auswählen",
    historyBoardColumnText: "Text",
    historyBoardColumnVoice: "Stimme",
    historyBoardColumnCreatedAt: "Erstellt am",
    historyBoardColumnAudio: "Audio",
    historyBoardColumnActions: "Aktionen",
    historyBoardRecordAudioLabel: "Nimm dein Audio auf",
    historyDuration: "Gesamtdauer:",
    historyLoading: "Wird geladen…",
    historyDownload: "Herunterladen",
    historyDelete: "Löschen",
    historyConfirmDelete: "Dieses Audio löschen?",
    historyClear: "Leeren",
    historyRetention:
      "Automatische Aufbewahrung: behält die letzten {maxItems} Einträge und nur die letzten {maxDays} Tage. Bei Überschreitung werden ältere Einträge automatisch gelöscht. Speicherlimit: {maxTotalBytes}; bei Überschreitung wird die Generierung blockiert, bis du löschst.",
    historyConfirmClearAll: "Die gesamte generierte Historie leeren?",
    inputPlaceholder: "Text eingeben, um Sprache zu erzeugen…",
    uploadFile: "Datei hochladen",
    customTitleToggle: "Eigener Name",
    customTitlePlaceholder: "Audioname (optional)",
    clearText: "Text löschen",
    generate: "Generieren",
    stop: "Stopp",
    noAudioYetStart: "Noch kein Audio. Klicke auf ",
    noAudioYetEnd: ", um deine erste MP3 zu erstellen.",
    noHistoryYet: "Noch keine Historie. {generate} Audio auf der Seite {textToSpeech}.",
    playback: "Wiedergabe",
    playbackNote: "Wirkt sich nur auf die Wiedergabegeschwindigkeit aus (näher an einer strikten Geschwindigkeitsänderung). Es wird kein Audio neu generiert und der TTS-Verbrauch steigt nicht.",
    speed: "Geschwindigkeit",
    speedModeAuto: "Automatisch",
    speedModeCustom: "Benutzerdefiniert",
    speedRateLabel: "Faktor",
    tone: "Ton",
    toneOptions: {
      neutral: "Neutral",
      calm: "Ruhig",
      serious: "Ernst",
      cheerful: "Fröhlich",
      excited: "Aufgeregt",
      surprised: "Überrascht",
    },
    volume: "Lautstärke",
    speakingRateWhyTitle: "Warum fühlt es sich eventuell nicht wie 4x an?",
    speakingRateWhyItems: [
      "Es ist ein relatives Sprechtempo-/Prosodie-Ziel: Google synthetisiert neu (kein simples Time-Stretching) und kann Änderungen für Verständlichkeit und Natürlichkeit begrenzen—daher wirkt es nicht perfekt linear.",
      "Pausen schrumpfen nicht proportional: Pausen durch Satzzeichen/Zeilenumbrüche und Phrasierung haben Fixkosten, daher kann das Ergebnis weniger als 4x wirken.",
      "Stimmen reagieren unterschiedlich: besonders Stimmen wie Chirp3‑HD (Despina) können bei hohen Tempi konservativer sein, sodass der wahrgenommene Effekt kleiner ausfällt.",
      "Wenn du es schneller willst, nutze {playback}.",
    ],
    languageTip:
      "Tipp: Beim Wechsel der Sprache wird automatisch eine sichere Standardstimme gewählt; klicke auf eine Karte, um eine Stimme für diese Sprache zu fixieren.",
    toneHelpAria: "Ton-Hilfe",
    toneHelpTitle: "Ton-Hilfe",
    toneHelpDialogTitle: "Ton-Leitfaden",
    toneHelpDialogDescription:
      "Ton beschreibt den Stil/die Emotion, die du in der synthetisierten Stimme möchtest. Die Unterstützung variiert je nach Anbieter, wird aber als Stilhinweis bei der Generierung genutzt.",
    toneHelpClose: "Schließen",
    toneHelpItems: [
      { label: "Neutral", description: "Neutral und natürlich; keine starke Emotion. Gut für Sprechertext, Erklärungen und lange Texte." },
      { label: "Ruhig", description: "Ruhiger, weicher und entspannter. Gut für Tutorials, Meditation und ruhiges Storytelling." },
      { label: "Ernst", description: "Formeller und ernster. Gut für Ankündigungen, Nachrichten und sachliche Inhalte." },
      { label: "Fröhlich", description: "Heller und freundlicher. Gut für Begrüßungen, Marketing-Skripte und leichte Gespräche." },
      { label: "Aufgeregt", description: "Energiereicher mit mehr Betonung. Gut für Intros, Highlights und Promotions." },
      { label: "Überrascht", description: "‘Überrascht/Plot-Twist’ mit stärkerer Intonation. Gut für Wendungen, Spannung und Pointen." },
    ],
  },
};

export function getPodcastMvpUiCopy(locale: Locale): PodcastMvpUiCopy {
  return {
    ...PODCAST_MVP_UI_COPY.en,
    ...(PODCAST_MVP_UI_COPY[locale] ?? {}),
  };
}

function ToneHelpDialog() {
  const { locale } = useLocale();
  const copy = getPodcastMvpUiCopy(locale);
  const itemSeparator = locale === "zh" || locale === "ja" ? "：" : ": ";

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
          aria-label={copy.toneHelpAria}
          title={copy.toneHelpTitle}
        >
          <QuestionMarkCircledIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 data-[state=open]:animate-overlayShow" />
        <Dialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[520px] translate-x-[-50%] translate-y-[-50%] rounded-[12px] bg-background p-6 shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none z-[51] data-[state=open]:animate-contentShow">
          <Dialog.Title className="text-foreground m-0 text-[16px] font-semibold">
            {copy.toneHelpDialogTitle}
          </Dialog.Title>
          <Dialog.Description className="text-foreground/70 mt-2 text-[13px] leading-relaxed">
            {copy.toneHelpDialogDescription}
          </Dialog.Description>

          <div className="mt-4 space-y-2 text-[13px] leading-relaxed text-foreground">
            {copy.toneHelpItems.map((it) => (
              <div key={it.label}>
                <span className="font-medium">{it.label}</span>
                {itemSeparator}
                {it.description}
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-muted/10 px-4 text-sm text-foreground hover:bg-muted/20"
              >
                {copy.toneHelpClose}
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const PremiumCrownIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
    <path d="M5 21h14" />
  </svg>
);

const NotebookTextIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={clsx("lucide lucide-notebook-text-icon lucide-notebook-text", className)}
    aria-hidden="true"
  >
    <path d="M2 6h4" />
    <path d="M2 10h4" />
    <path d="M2 14h4" />
    <path d="M2 18h4" />
    <rect width="16" height="20" x="4" y="2" rx="2" />
    <path d="M9.5 8h5" />
    <path d="M9.5 12H16" />
    <path d="M9.5 16H14" />
  </svg>
);

const HistoryIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={clsx("lucide lucide-history-icon lucide-history", className)}
    aria-hidden="true"
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);

function VoicePickerSkeleton() {
  return (
    <div className="flex flex-col gap-3 h-full">
      <Skeleton className="h-9 w-full rounded-xl" />
      <Skeleton className="h-9 w-full rounded-xl" />
      <Skeleton className="h-9 w-full rounded-xl" />
      <div className="mt-3 flex-1 min-h-0 max-h-[500px] overflow-y-auto rounded-xl border border-border bg-muted/20 shadow-inner">
        <div className="p-3 grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div
              key={`voice-skel-${idx}`}
              className="w-full flex flex-col items-center gap-2 rounded-lg p-2"
            >
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const GoogleVoicePicker = dynamic(() => import("./GoogleVoicePicker"), {
  ssr: false,
  loading: () => <VoicePickerSkeleton />,
});

export default function TtsPage() {
  const isVoiceCloningUiEnabled = process.env.NEXT_PUBLIC_VOICE_CLONING_ENABLED === "1";
  const [currentView, setCurrentView] = useState<ViewType>('tts');
  const isScrollable = useBodyScrollable();
  const { locale } = useLocale();
  const router = useRouter();
  const [isVoiceCloningPaid, setIsVoiceCloningPaid] = useState<boolean | null>(null);

  const homeLabelByLocale: Partial<Record<Locale, string>> = {
    en: "Home",
    zh: "首页",
    es: "Inicio",
    ar: "الرئيسية",
    id: "Beranda",
    pt: "Início",
    fr: "Accueil",
    ja: "ホーム",
    ru: "Главная",
    de: "Start",
  };

  const podcastLabelByLocale: Partial<Record<Locale, string>> = {
    en: "Podcast MVP",
    zh: "播客生成",
    es: "Podcast MVP",
    ar: "Podcast MVP",
    id: "Podcast MVP",
    pt: "Podcast MVP",
    fr: "Podcast MVP",
    ja: "Podcast MVP",
    ru: "Podcast MVP",
    de: "Podcast MVP",
  };

  const homeLabel = homeLabelByLocale[locale] ?? "Home";
  const podcastLabel = podcastLabelByLocale[locale] ?? "Podcast MVP";
  const homeHref = locale === "en" ? "/" : `/${locale}/`;
  const pricingHref = `/${locale}/pricing`;

  useEffect(() => {
    if (!isVoiceCloningUiEnabled && currentView === "cloning") {
      setCurrentView("tts");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVoiceCloningUiEnabled]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/membership/status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        const isPaid = (json as { data?: { isPaid?: unknown } } | null)?.data?.isPaid;
        if (typeof isPaid === "boolean") setIsVoiceCloningPaid(isPaid);
        else setIsVoiceCloningPaid(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsVoiceCloningPaid(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleVoiceCloningClick = async () => {
    if (!isVoiceCloningUiEnabled) return;
    if (isVoiceCloningPaid === true) {
      setCurrentView("cloning");
      return;
    }

    // If status is unknown, re-check once to avoid stale UI.
    if (isVoiceCloningPaid === null) {
      try {
        const res = await fetch("/api/membership/status", { cache: "no-store" });
        const json = res.ok ? ((await res.json()) as { data?: { isPaid?: unknown } }) : null;
        const isPaid = json?.data?.isPaid;
        if (typeof isPaid === "boolean") {
          setIsVoiceCloningPaid(isPaid);
          if (isPaid) {
            setCurrentView("cloning");
            return;
          }
        }
      } catch {
        setIsVoiceCloningPaid(false);
      }
    }

    router.push(pricingHref);
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden selection:bg-primary/20">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        onVoiceCloningClick={handleVoiceCloningClick}
        showVoiceCloning={isVoiceCloningUiEnabled}
      />
      <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
        <main
          data-scrollable={isScrollable}
          className="flex-1 overflow-y-auto no-scrollbar px-5 pt-6 pb-32 md:pb-24"
        >
	          <div className="max-w-[1300px] mx-auto">
              <div className="mb-6 flex justify-center md:justify-start">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link href={homeHref}>{homeLabel}</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{podcastLabel}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
	             <Header />
	             {currentView === 'tts' ? (
	               <TTSBoard />
	             ) : (
	               <CloningBoard onGoToTts={() => setCurrentView("tts")} />
	             )}
	             <Footer />
	          </div>
	        </main>
      </div>
    </div>
  );
}

const Sidebar = ({
  currentView,
  onViewChange,
  onVoiceCloningClick,
  showVoiceCloning,
}: {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onVoiceCloningClick: () => void;
  showVoiceCloning: boolean;
}) => {
  const { locale } = useLocale();
  const router = useRouter();
  const copy = getPodcastMvpUiCopy(locale);
  const historyHref = locale === "en" ? "/podcast-mvp/history" : `/${locale}/podcast-mvp/history`;

  return (
	    <aside className="w-64 bg-background border-r border-border hidden md:flex flex-col">
	      <div className="p-6">
	        <div className="flex items-center gap-3">
	           <Image
	             src="/photo/text-to-speech.webp"
	             alt="RTVox"
	             width={32}
	             height={32}
	             className="h-8 w-8 rounded-lg"
	           />
			           <span className="font-bold text-lg tracking-tight">{siteConfig.brandName}</span>
	        </div>
	      </div>

      <nav className="flex-1 px-4 py-2 space-y-1">
	    <SidebarItem 
	      icon={<NotebookTextIcon className="w-5 h-5" />} 
	      label={copy.sidebarTextToSpeech}
	      active={currentView === 'tts'} 
	      onClick={() => onViewChange('tts')}
	    />
          {showVoiceCloning ? (
	          <SidebarItem 
	            icon={<Waveform className="w-5 h-5" />} 
	            label={
                <span className="flex items-center gap-2">
                  <PremiumCrownIcon className="w-4 h-4" />
                  <span>Voice Cloning</span>
                </span>
              }
	            active={currentView === 'cloning'}
	            onClick={onVoiceCloningClick}
	          />
          ) : null}
	        <SidebarItem
	          icon={<HistoryIcon className="w-5 h-5" />}
	          label={copy.sidebarHistory}
	          active={false}
	          onClick={() => router.push(historyHref)}
	        />
	      </nav>

	      <div className="px-4 py-2 mt-auto">
	        <div className="p-3 rounded-lg bg-muted/30 border border-border mb-6">
	          <div className="text-sm font-medium">{copy.sidebarSupportTitle}</div>
	          <a
	            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
		            href={`mailto:${siteConfig.supportEmail}`}
		          >
			            {siteConfig.supportEmail}
			          </a>
	        </div>
	      </div>
	    </aside>
	  );
	};

const SidebarItem = ({ icon, label, active, onClick }: { icon: React.ReactNode; label: React.ReactNode; active?: boolean; onClick?: () => void }) => {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      <span className="flex items-center gap-2">{label}</span>
    </button>
  );
};

const TTSBoard = () => {
  const { locale } = useLocale();
  const copy = getPodcastMvpUiCopy(locale);
  const toneLabel = (value: string) => {
    if (value === "neutral") return copy.toneOptions.neutral;
    if (value === "calm") return copy.toneOptions.calm;
    if (value === "serious") return copy.toneOptions.serious;
    if (value === "cheerful") return copy.toneOptions.cheerful;
    if (value === "excited") return copy.toneOptions.excited;
    if (value === "surprised") return copy.toneOptions.surprised;
    return value;
  };

  const tone = appStore.useState((state) => state.tone);
  const speakingRateMode = appStore.useState((state) => state.speakingRateMode);
  const speakingRate = appStore.useState((state) => state.speakingRate);
  const playbackRate = appStore.useState((state) => state.playbackRate);
  const volumeGainDb = appStore.useState((state) => state.volumeGainDb);
  const input = appStore.useState((state) => state.input);
  const customTitleEnabled = appStore.useState((state) => state.customTitleEnabled);
  const customTitle = appStore.useState((state) => state.customTitle);
  const voice = appStore.useState((state) => state.voice);
  const browserNotSupported = appStore.useState(
    () => !("serviceWorker" in navigator)
  );
  const [costEstimate, setCostEstimate] = useState<CostEstimateData | null>(null);
  const estimatedTokens =
    costEstimate?.supported && typeof costEstimate?.tokenEstimate?.tokens === "number"
      ? costEstimate.tokenEstimate.tokens
      : input.length === 0
        ? 0
        : Math.ceil(input.length / 4);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importedParts, setImportedParts] = useState<string[] | null>(null);
  const [activePartIndex, setActivePartIndex] = useState(0);

	  useEffect(() => {
	    let cancelled = false;
	    const chars = input.length;
	    const v = voice;
	    const t = window.setTimeout(() => {
        if (cancelled) return;
        if (!chars || !v) {
          setCostEstimate(null);
          return;
        }
	      const url = new URL("/api/tts/cost", window.location.origin);
	      url.searchParams.set("voice", v);
	      url.searchParams.set("chars", String(chars));
	      fetch(url.toString(), { cache: "no-store" })
	        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (cancelled) return;
          const data = (json as { data?: unknown } | null)?.data as CostEstimateData | undefined;
          if (!data || typeof data.supported !== "boolean") {
            setCostEstimate(null);
            return;
          }
          setCostEstimate(data);
        })
        .catch(() => {
          if (cancelled) return;
          setCostEstimate(null);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [input.length, voice]);

  const formatPartSize = (length: number) => {
    if (!Number.isFinite(length) || length <= 0) return "0";
    if (length >= 1000) return `${Math.floor(length / 1000)}k`;
    return String(length);
  };

  const splitTextIntoParts = (text: string, maxLen = 5000) => {
    const normalized = text.replace(/\r\n/g, "\n");
    const parts: string[] = [];
    let remaining = normalized;

    while (remaining.length > maxLen) {
      const candidate = remaining.slice(0, maxLen);
      const breakAt = Math.max(candidate.lastIndexOf("\n"), candidate.lastIndexOf(" "));
      const cut = breakAt > Math.floor(maxLen * 0.6) ? breakAt : maxLen;
      parts.push(remaining.slice(0, cut).trimEnd());
      remaining = remaining.slice(cut).replace(/^\s+/, "");
    }

    parts.push(remaining);
    return parts.filter((p) => p.length > 0);
  };

  const setInputText = (next: string) => {
    appStore.setState((draft) => {
      draft.input = next;
      draft.latestAudioUrl = null;
      draft.latestAudioBlobUrl = null;
    });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File too large. Please upload a text file under 5MB.");
      return;
    }

    const text = await file.text();
    const parts = splitTextIntoParts(text, 5000);
    if (parts.length === 0) return;

    setImportedParts(parts);
    setActivePartIndex(0);
    setInputText(parts[0] ?? "");
  };

  const handleSelectPart = (idx: number) => {
    if (!importedParts?.[idx]) return;
    setActivePartIndex(idx);
    setInputText(importedParts[idx] ?? "");
  };

  const handleClearText = () => {
    if (!input.trim() && !importedParts) return;
    setImportedParts(null);
    setActivePartIndex(0);
    setInputText("");
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full relative">
      {browserNotSupported && (
        <BrowserNotSupported
          open={browserNotSupported}
          onOpenChange={() => {}}
        />
      )}

      <div className="flex flex-col lg:flex-row gap-6 h-full pb-6">
        {/* Left Column: Text Input & Controls (1/2 Width) */}
        <div className="lg:flex-[2_1_0%] flex flex-col min-w-0 h-full">
          <Block title={copy.blockTextToSpeech}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={handleUploadClick}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-muted/20 px-4 text-sm font-medium text-foreground hover:bg-muted/30"
                >
                  <Upload className="h-4 w-4" />
                  {copy.uploadFile}
                </button>

                <div className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-muted/10 px-3 text-sm text-muted-foreground">
                  <Switch.Root
                    checked={customTitleEnabled}
                    onCheckedChange={(checked) => {
                      appStore.setState((draft) => {
                        draft.customTitleEnabled = Boolean(checked);
                      });
                    }}
                    className={clsx(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border transition-colors",
                      customTitleEnabled ? "bg-primary/80" : "bg-muted/40",
                    )}
                    aria-label={copy.customTitleToggle}
                  >
                    <Switch.Thumb
                      className={clsx(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform",
                        customTitleEnabled ? "translate-x-4" : "translate-x-1",
                      )}
                    />
                  </Switch.Root>
                  <span className="whitespace-nowrap">{copy.customTitleToggle}</span>
                </div>

	                {customTitleEnabled ? (
	                  <input
	                    value={customTitle}
	                    onChange={(e) => {
	                      const next = e.target.value.slice(0, 80);
	                      appStore.setState((draft) => {
	                        draft.customTitle = next;
	                      });
	                    }}
	                    placeholder={copy.customTitlePlaceholder}
	                    className="h-9 w-[220px] max-w-full rounded-full border border-border bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
	                  />
	                ) : null}

                  <div
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-muted/20 px-4 text-sm text-muted-foreground"
                    dir="ltr"
                    title={`Tokens · est. cost ${Math.max(0, Math.floor(estimatedTokens)).toLocaleString()}`}
                  >
                    <Coins className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <span>{Math.max(0, Math.floor(estimatedTokens)).toLocaleString()}</span>
                  </div>

                {importedParts ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {importedParts.map((part, idx) => {
                      const active = idx === activePartIndex;
                      return (
                        <button
                          key={`part-${idx}`}
                          type="button"
                          onClick={() => handleSelectPart(idx)}
                          className={clsx(
                            "inline-flex h-9 items-center rounded-full border px-4 text-sm transition-colors",
                            active
                              ? "border-foreground/40 bg-foreground/10 text-foreground"
                              : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground",
                          )}
                          aria-pressed={active}
                        >
                          Part {idx + 1}
                          <span className={clsx("ml-2 text-xs", active ? "text-foreground/80" : "text-muted-foreground")}>
                            {formatPartSize(part.length)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

			              <div className="flex items-center gap-3">
			                <div className="inline-flex h-9 items-center rounded-full border border-border bg-muted/20 px-4 text-sm text-muted-foreground" dir="ltr">
			                  {input.length} / 5000 characters
			                </div>
                <button
			                  type="button"
		                  onClick={handleClearText}
                  className={clsx(
                    "inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors",
                    input.trim() || importedParts ? "text-muted-foreground hover:text-foreground" : "pointer-events-none opacity-40 text-muted-foreground",
                  )}
                >
                  <X className="h-4 w-4" />
                  {copy.clearText}
                </button>
              </div>
            </div>
            <div className="relative flex flex-col h-full w-full">
              <textarea
                id="input"
                className="w-full min-h-[400px] lg:min-h-[450px] flex-1 resize-none outline-none focus:outline-none bg-screen p-6 rounded-xl shadow-textarea text-[18px] md:text-[16px] leading-relaxed"
                value={input}
                onChange={({ target }) => {
                  const nextValue = target.value.slice(0, 5000);
                  appStore.setState((draft) => {
                    draft.input = nextValue;
                    draft.latestAudioUrl = null;
                    draft.latestAudioBlobUrl = null;
                  });
                  if (importedParts) {
                    setImportedParts((prev) => {
                      if (!prev) return prev;
                      const next = [...prev];
                      next[activePartIndex] = nextValue;
                      return next;
                    });
                  }
                }}
                placeholder={copy.inputPlaceholder}
                maxLength={5000}
              />
            </div>


            {/* Controls */}
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="tone" className="text-xs text-muted-foreground">
                      {copy.tone}
                    </label>
                    <ToneHelpDialog />
                  </div>
                  <select
                    id="tone"
                    value={tone}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const next =
                        raw === "calm" ||
                        raw === "serious" ||
                        raw === "cheerful" ||
                        raw === "excited" ||
                        raw === "surprised"
                          ? raw
                          : "neutral";
                      appStore.setState((draft) => {
                        draft.tone = next;
                        draft.latestAudioUrl = null;
                        draft.latestAudioBlobUrl = null;
                      });
                    }}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    <option value="neutral">{copy.toneOptions.neutral}</option>
                    <option value="calm">{copy.toneOptions.calm}</option>
                    <option value="serious">{copy.toneOptions.serious}</option>
                    <option value="cheerful">{copy.toneOptions.cheerful}</option>
                    <option value="excited">{copy.toneOptions.excited}</option>
                    <option value="surprised">{copy.toneOptions.surprised}</option>
                  </select>
                </div>

                <label className="text-xs text-muted-foreground flex flex-col gap-1.5 md:col-span-3">
                  {copy.speed}
                  <select
                    value={speakingRateMode}
                    onChange={(e) => {
                      const next = e.target.value === "custom" ? "custom" : "auto";
                      appStore.setState((draft) => {
                        draft.speakingRateMode = next;
                        draft.latestAudioUrl = null;
                        draft.latestAudioBlobUrl = null;
                      });
                    }}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    <option value="auto">{copy.speedModeAuto}</option>
                    <option value="custom">{copy.speedModeCustom}</option>
                  </select>
                </label>

                {speakingRateMode === "custom" ? (
                  <label className="text-xs text-muted-foreground flex flex-col gap-1.5 md:col-span-6">
                    <div className="flex justify-between">
                      <span>{copy.speedRateLabel}</span>
                      <span className="font-mono text-foreground">{speakingRate.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min={0.25}
                      max={4}
                      step={0.05}
                      value={speakingRate}
                      onChange={(e) => {
                        const next = Math.max(0.25, Math.min(4, Number(e.target.value) || 1));
                        appStore.setState((draft) => {
                          draft.speakingRate = next;
                          draft.latestAudioUrl = null;
                          draft.latestAudioBlobUrl = null;
                        });
                      }}
                      className="w-full mt-1.5"
                    />
                  </label>
                ) : null}

                <label className="text-xs text-muted-foreground flex flex-col gap-1.5 md:col-span-6">
                  <div className="flex justify-between">
                    <span>{copy.playback}</span>
                    <span className="font-mono text-foreground">{playbackRate.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={4}
                    step={0.05}
                    value={playbackRate}
                    onChange={(e) => {
                      const next = Math.max(0.25, Math.min(4, Number(e.target.value) || 1));
                      appStore.setState((draft) => {
                        draft.playbackRate = next;
                      });
                    }}
                    className="w-full mt-1.5"
                  />
                  <div className="text-[11px] leading-4 text-muted-foreground">{copy.playbackNote}</div>
                </label>

                <label className="text-xs text-muted-foreground flex flex-col gap-1.5 md:col-span-6">
                  <div className="flex justify-between">
                    <span>{copy.volume}</span>
                    <span className="font-mono text-foreground">{volumeGainDb > 0 ? `+${volumeGainDb}` : volumeGainDb}dB</span>
                  </div>
                  <input
                    type="range"
                    min={-10}
                    max={10}
                    step={1}
                    value={volumeGainDb}
                    onChange={(e) => {
                      const next = Math.max(-96, Math.min(16, Math.round(Number(e.target.value) || 0)));
                      appStore.setState((draft) => {
                        draft.volumeGainDb = next;
                        draft.latestAudioUrl = null;
                        draft.latestAudioBlobUrl = null;
                      });
                    }}
                    className="w-full mt-1.5"
                  />
                </label>
              </div>

              {speakingRateMode === "custom" ? (
                <div className="rounded-xl border border-border bg-background/60 p-4 text-[11px] leading-4 text-muted-foreground">
                  <div className="font-medium text-foreground/80">{copy.speakingRateWhyTitle}</div>
                  <ul className="mt-2 list-disc pl-4 space-y-1">
                    {copy.speakingRateWhyItems.map((item, idx) => (
                      <li key={`${idx}-${item.slice(0, 24)}`}>
                        {formatTemplate(item, { playback: copy.playback })}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

			              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-4 border-t border-border/50">
			                <div className="text-[11px] text-muted-foreground italic">
			                  {copy.languageTip}
			                </div>
			                <div className="flex flex-row flex-wrap gap-3 w-full sm:w-auto">
			                  <ShareButton />
			                  <div className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-muted/10 px-3 text-sm text-muted-foreground">
			                    <Switch.Root
			                      checked={customTitleEnabled}
			                      onCheckedChange={(checked) => {
			                        appStore.setState((draft) => {
			                          draft.customTitleEnabled = Boolean(checked);
			                        });
			                      }}
			                      className={clsx(
			                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border transition-colors",
			                        customTitleEnabled ? "bg-primary/80" : "bg-muted/40",
			                      )}
			                      aria-label={copy.customTitleToggle}
			                    >
			                      <Switch.Thumb
			                        className={clsx(
			                          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform",
			                          customTitleEnabled ? "translate-x-4" : "translate-x-1",
			                        )}
			                      />
			                    </Switch.Root>
			                    <span className="whitespace-nowrap">{copy.customTitleToggle}</span>
			                  </div>
			
			                  {customTitleEnabled ? (
			                    <input
			                      value={customTitle}
			                      onChange={(e) => {
			                        const next = e.target.value.slice(0, 80);
			                        appStore.setState((draft) => {
			                          draft.customTitle = next;
			                        });
			                      }}
			                      placeholder={copy.customTitlePlaceholder}
			                      className="h-9 w-[220px] max-w-full rounded-full border border-border bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
			                    />
			                  ) : null}
			                  <div className="flex-1 sm:min-w-[120px]">
			                    <PlayButton />
			                  </div>
			                </div>
			              </div>
	            </div>
	          </Block>
	        </div>

        {/* Right Column: Voice Selection Only (1/2 Width) */}
        <div className="lg:flex-[1_1_0%] flex flex-col min-w-0 h-full">
          <Block title={copy.blockSelectVoice}>
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-hidden flex flex-col min-h-[400px] lg:min-h-[600px]">
                <GoogleVoicePicker />
              </div>
	            </div>
	          </Block>
		        </div>
		      </div>
	    </div>
	  );
	};

const CloningBoard = ({ onGoToTts }: { onGoToTts: () => void }) => {
  return <VoiceCloningClient onGoToTts={onGoToTts} />;
};
