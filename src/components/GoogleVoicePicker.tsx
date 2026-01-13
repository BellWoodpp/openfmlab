"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { appStore } from "@/lib/store";
import { defaultLocale, locales, type Locale } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Check } from "@/components/ui/Icons";
import { Skeleton } from "@/components/ui/skeleton";
import { voiceAvatarDataUri } from "@/lib/voice-avatar";
import { siteConfig } from "@/lib/site-config";

type VoicesResponse = {
  lang: string;
  q?: string;
  count: number;
  voices: Array<{
    name: string;
    languageCodes: string[];
    ssmlGender?: string;
    naturalSampleRateHertz?: number | null;
    billingTier: string;
    billingTierSource?: "name" | "heuristic";
  }>;
};

type MetaResponse = {
  provider: "openai" | "google";
  voiceInput?: string;
  voiceName?: string;
  languageCode?: string;
  billingTier?: string;
};

type LanguagesResponse = {
  count: number;
  languages: string[];
};

type PublicVoiceTier = "all" | "standard" | "wavenet" | "neural2" | "chirp3-hd" | "studio";

const STATIC_PUBLIC_VOICES: VoicesResponse["voices"] = [
  { name: "en-US-Standard-C", languageCodes: ["en-US"], billingTier: "standard" },
  { name: "en-US-Standard-J", languageCodes: ["en-US"], billingTier: "standard" },
  { name: "en-US-Wavenet-D", languageCodes: ["en-US"], billingTier: "wavenet" },
  { name: "en-US-Neural2-F", languageCodes: ["en-US"], billingTier: "neural2" },
  { name: "en-US-Studio-O", languageCodes: ["en-US"], billingTier: "studio" },
  { name: "en-US-Chirp3-HD-Umbriel", languageCodes: ["en-US"], billingTier: "chirp3-hd" },

  { name: "zh-CN-Standard-A", languageCodes: ["zh-CN"], billingTier: "standard" },
  { name: "zh-CN-Wavenet-A", languageCodes: ["zh-CN"], billingTier: "wavenet" },
  { name: "zh-CN-Neural2-A", languageCodes: ["zh-CN"], billingTier: "neural2" },

  { name: "ja-JP-Standard-A", languageCodes: ["ja-JP"], billingTier: "standard" },
  { name: "ja-JP-Wavenet-A", languageCodes: ["ja-JP"], billingTier: "wavenet" },
  { name: "ja-JP-Neural2-B", languageCodes: ["ja-JP"], billingTier: "neural2" },
];

const STATIC_LANGUAGE_OPTIONS = ["en-US", "zh-CN", "ja-JP"];

type VoiceTierHelpCopy = {
  summary: string;
  separator: string;
  standard: string;
  wavenet: string;
  neural2: string;
  chirp3Hd: string;
  studio: string;
  all: string;
  pricingNote: string;
};

const VOICE_TIER_HELP_COPY: Record<Locale, VoiceTierHelpCopy> = {
  en: {
    summary: "Pricing & tier notes",
    separator: ": ",
    standard: "Most basic / cheapest (baseline 1x; after the free tier, billed at the lowest unit price).",
    wavenet: "WaveNet voices (about 4x standard).",
    neural2:
      "Next-gen neural voices (often better quality and often pricier; budget at ~4x standard by default).",
    chirp3Hd: "Higher-quality Chirp3‑HD voices (about 7.5x standard).",
    studio: "Studio voices (about 40x standard).",
    all: "Show all voices available for the current language (including higher-priced tiers).",
    pricingNote:
      "Prices are based on Google Cloud Text-to-Speech official pricing (per 1M chars beyond free tier, in HKD; standard≈31.1, wavenet≈124.4→4x, chirp3‑hd≈233.2→7.5x, studio≈1243.9→40x).",
  },
  zh: {
    summary: "查看价格/档位说明",
    separator: "：",
    standard: "最基础/最便宜（基准 1x；超出免费额度后按最低单价计费）",
    wavenet: "WaveNet 系列（约 4x standard）",
    neural2: "新一代神经网络声音系列（通常质量更好、也通常更贵；默认按约 4x standard 预算）",
    chirp3Hd: "更高质量的 Chirp3‑HD 系列（约 7.5x standard）",
    studio: "Studio 系列（约 40x standard）",
    all: "显示当前语言下所有可用声音（包含更贵的 tier）",
    pricingNote:
      "价格基于 Google Cloud Text-to-Speech 官方价目表（按超出免费额度后的每 100 万字符，HKD 口径；standard≈31.1、wavenet≈124.4→4x、chirp3‑hd≈233.2→7.5x、studio≈1243.9→40x）。",
  },
  ja: {
    summary: "価格/ティアの説明",
    separator: "：",
    standard: "最も基本/最安（基準 1x；無料枠を超えると最安単価で課金）",
    wavenet: "WaveNet 系（standard の約 4x）",
    neural2: "新世代のニューラル音声（通常は品質が良く、価格も高めになりがち；既定では standard の約 4x として見積もり）",
    chirp3Hd: "高品質な Chirp3‑HD 系（standard の約 7.5x）",
    studio: "Studio 系（standard の約 40x）",
    all: "現在の言語で利用可能な全ての音声を表示（より高価な tier も含む）",
    pricingNote:
      "価格は Google Cloud Text-to-Speech 公式の料金表に基づきます（無料枠超過後の 100 万文字あたり、HKD；standard≈31.1、wavenet≈124.4→4x、chirp3‑hd≈233.2→7.5x、studio≈1243.9→40x）。",
  },
  es: {
    summary: "Notas de precios/niveles",
    separator: ": ",
    standard:
      "Lo más básico / más barato (base 1x; después del nivel gratuito se cobra al precio unitario más bajo).",
    wavenet: "Voces WaveNet (≈4x standard).",
    neural2:
      "Voces Neural2 de nueva generación (normalmente mejor calidad y también más caras; por defecto se estima ≈4x standard).",
    chirp3Hd: "Voces Chirp3‑HD de mayor calidad (≈7.5x standard).",
    studio: "Voces Studio (≈40x standard).",
    all: "Muestra todas las voces disponibles para el idioma actual (incluye niveles más caros).",
    pricingNote:
      "Precios basados en la lista oficial de Google Cloud Text-to-Speech (por 1M de caracteres tras agotar el nivel gratuito, en HKD; standard≈31.1, wavenet≈124.4→4x, chirp3‑hd≈233.2→7.5x, studio≈1243.9→40x).",
  },
  ar: {
    summary: "ملاحظات التسعير/الفئات",
    separator: ": ",
    standard: "الأكثر أساسية/الأرخص (الأساس 1x؛ بعد تجاوز الحصة المجانية يتم الحساب بأقل سعر للوحدة).",
    wavenet: "أصوات WaveNet (حوالي 4x standard).",
    neural2:
      "أصوات Neural2 (جيل أحدث؛ غالبًا جودة أفضل وغالبًا أغلى؛ افتراضيًا تُقدّر بحوالي 4x standard).",
    chirp3Hd: "أصوات Chirp3‑HD بجودة أعلى (حوالي 7.5x standard).",
    studio: "أصوات Studio (حوالي 40x standard).",
    all: "عرض جميع الأصوات المتاحة للغة الحالية (بما في ذلك الفئات الأعلى سعرًا).",
    pricingNote:
      "الأسعار مبنية على قائمة أسعار Google Cloud Text-to-Speech الرسمية (لكل مليون حرف بعد الحصة المجانية، وبعملة HKD؛ standard≈31.1، wavenet≈124.4→4x، chirp3‑hd≈233.2→7.5x، studio≈1243.9→40x).",
  },
  id: {
    summary: "Catatan harga/tier",
    separator: ": ",
    standard: "Paling dasar / paling murah (patokan 1x; setelah kuota gratis habis, ditagih dengan harga satuan terendah).",
    wavenet: "Suara WaveNet (≈4x standard).",
    neural2: "Suara Neural2 generasi baru (biasanya kualitas lebih baik dan biasanya lebih mahal; default diasumsikan ≈4x standard).",
    chirp3Hd: "Suara Chirp3‑HD kualitas lebih tinggi (≈7.5x standard).",
    studio: "Suara Studio (≈40x standard).",
    all: "Tampilkan semua suara yang tersedia untuk bahasa saat ini (termasuk tier yang lebih mahal).",
    pricingNote:
      "Harga berdasarkan daftar resmi Google Cloud Text-to-Speech (per 1 juta karakter setelah melewati kuota gratis, dalam HKD; standard≈31.1, wavenet≈124.4→4x, chirp3‑hd≈233.2→7.5x, studio≈1243.9→40x).",
  },
  pt: {
    summary: "Notas de preço/nível",
    separator: ": ",
    standard: "Mais básico / mais barato (base 1x; após a franquia gratuita, cobrado pelo menor preço unitário).",
    wavenet: "Vozes WaveNet (≈4x standard).",
    neural2:
      "Vozes Neural2 de nova geração (geralmente melhor qualidade e também mais caras; por padrão orçado em ≈4x standard).",
    chirp3Hd: "Vozes Chirp3‑HD de maior qualidade (≈7.5x standard).",
    studio: "Vozes Studio (≈40x standard).",
    all: "Mostra todas as vozes disponíveis para o idioma atual (inclui tiers mais caros).",
    pricingNote:
      "Preços baseados na tabela oficial do Google Cloud Text-to-Speech (por 1M de caracteres após exceder a franquia gratuita, em HKD; standard≈31.1, wavenet≈124.4→4x, chirp3‑hd≈233.2→7.5x, studio≈1243.9→40x).",
  },
  fr: {
    summary: "Notes sur les prix/niveaux",
    separator: " : ",
    standard: "Le plus basique / le moins cher (base 1x ; au-delà du quota gratuit, facturé au prix unitaire le plus bas).",
    wavenet: "Voix WaveNet (≈4x standard).",
    neural2:
      "Voix Neural2 nouvelle génération (souvent meilleure qualité et souvent plus chère ; estimée par défaut à ≈4x standard).",
    chirp3Hd: "Voix Chirp3‑HD de meilleure qualité (≈7.5x standard).",
    studio: "Voix Studio (≈40x standard).",
    all: "Affiche toutes les voix disponibles pour la langue actuelle (y compris des niveaux plus chers).",
    pricingNote:
      "Prix basés sur la grille officielle Google Cloud Text-to-Speech (par 1M de caractères au-delà du quota gratuit, en HKD ; standard≈31.1, wavenet≈124.4→4x, chirp3‑hd≈233.2→7.5x, studio≈1243.9→40x).",
  },
  ru: {
    summary: "Примечания по цене/тиру",
    separator: ": ",
    standard: "Самый базовый/дешёвый (база 1x; после исчерпания бесплатного лимита тарифицируется по минимальной цене).",
    wavenet: "Голоса WaveNet (≈4x standard).",
    neural2:
      "Голоса Neural2 нового поколения (обычно лучше качество и обычно дороже; по умолчанию считаем ≈4x standard).",
    chirp3Hd: "Более качественные голоса Chirp3‑HD (≈7.5x standard).",
    studio: "Голоса Studio (≈40x standard).",
    all: "Показать все голоса для текущего языка (включая более дорогие tiers).",
    pricingNote:
      "Цены основаны на официальном прайс-листе Google Cloud Text-to-Speech (за 1 млн символов сверх бесплатного лимита, в HKD; standard≈31.1, wavenet≈124.4→4x, chirp3‑hd≈233.2→7.5x, studio≈1243.9→40x).",
  },
  de: {
    summary: "Preis-/Tier-Hinweise",
    separator: ": ",
    standard:
      "Am einfachsten / am günstigsten (Basis 1x; nach dem Freikontingent zum niedrigsten Stückpreis abgerechnet).",
    wavenet: "WaveNet-Stimmen (≈4x standard).",
    neural2:
      "Neural2 (neue Generation; oft bessere Qualität und oft teurer; standardmäßig ≈4x standard kalkuliert).",
    chirp3Hd: "Chirp3‑HD in höherer Qualität (≈7.5x standard).",
    studio: "Studio-Stimmen (≈40x standard).",
    all: "Zeigt alle verfügbaren Stimmen für die aktuelle Sprache (inkl. teurerer Tiers).",
    pricingNote:
      "Preise basieren auf der offiziellen Google Cloud Text-to-Speech-Preisliste (pro 1 Mio. Zeichen nach dem Freikontingent, in HKD; standard≈31.1, wavenet≈124.4→4x, chirp3‑hd≈233.2→7.5x, studio≈1243.9→40x).",
  },
};

const VOICE_PICKER_LABEL_COPY = {
  en: {
    language: "Language",
    currentVoice: "Current voice:",
    clonedSuffix: "(cloned)",
    tier: "Tier:",
    resolved: "Resolved:",
    foundVoicesInTier: "Found {count} voices in {tier}.",
    pickCategoryHint: "Pick a category above to load voices.",
    tiersLabel: "Tiers:",
    previewPrefix: "Preview:",
    selectCategoryToShowVoices: "Select a category (tier) above to show voices.",
    noVoicesFound: "No voices found.",
    noVoicesFoundForTierInLang: "No voices found for {tier} in {lang}.",
  },
  zh: {
    language: "语言",
    currentVoice: "当前音色：",
    clonedSuffix: "（克隆）",
    tier: "档位：",
    resolved: "解析为：",
    foundVoicesInTier: "已找到 {count} 个音色（{tier}）。",
    pickCategoryHint: "请先选择上方档位以加载音色列表。",
    tiersLabel: "档位统计：",
    previewPrefix: "预览：",
    selectCategoryToShowVoices: "请先选择上方档位（tier）以显示音色列表。",
    noVoicesFound: "未找到音色。",
    noVoicesFoundForTierInLang: "在 {lang} 下未找到 {tier} 档位音色。",
  },
  ja: {
    language: "言語",
    currentVoice: "現在の音声：",
    clonedSuffix: "（クローン）",
    tier: "ティア：",
    resolved: "解決後：",
    foundVoicesInTier: "{tier} で {count} 件の音声が見つかりました。",
    pickCategoryHint: "上のカテゴリを選択して音声を読み込んでください。",
    tiersLabel: "ティア：",
    previewPrefix: "プレビュー：",
    selectCategoryToShowVoices: "上のカテゴリ（ティア）を選択して音声を表示してください。",
    noVoicesFound: "音声が見つかりません。",
    noVoicesFoundForTierInLang: "{lang} で {tier} の音声が見つかりません。",
  },
  es: {
    language: "Idioma",
    currentVoice: "Voz actual:",
    clonedSuffix: "(clonada)",
    tier: "Nivel:",
    resolved: "Resuelto:",
    foundVoicesInTier: "Se encontraron {count} voces en {tier}.",
    pickCategoryHint: "Elige una categoría arriba para cargar voces.",
    tiersLabel: "Niveles:",
    previewPrefix: "Vista previa:",
    selectCategoryToShowVoices: "Selecciona una categoría (nivel) arriba para ver voces.",
    noVoicesFound: "No se encontraron voces.",
    noVoicesFoundForTierInLang: "No se encontraron voces de {tier} en {lang}.",
  },
  ar: {
    language: "اللغة",
    currentVoice: "الصوت الحالي:",
    clonedSuffix: "(مستنسخ)",
    tier: "المستوى:",
    resolved: "تم التحويل إلى:",
    foundVoicesInTier: "تم العثور على {count} صوتًا في {tier}.",
    pickCategoryHint: "اختر فئة بالأعلى لتحميل الأصوات.",
    tiersLabel: "المستويات:",
    previewPrefix: "معاينة:",
    selectCategoryToShowVoices: "اختر فئة (مستوى) بالأعلى لعرض الأصوات.",
    noVoicesFound: "لم يتم العثور على أصوات.",
    noVoicesFoundForTierInLang: "لم يتم العثور على أصوات لـ {tier} ضمن {lang}.",
  },
  id: {
    language: "Bahasa",
    currentVoice: "Suara saat ini:",
    clonedSuffix: "(kloning)",
    tier: "Tier:",
    resolved: "Terekspos:",
    foundVoicesInTier: "Ditemukan {count} suara di {tier}.",
    pickCategoryHint: "Pilih kategori di atas untuk memuat suara.",
    tiersLabel: "Tier:",
    previewPrefix: "Pratinjau:",
    selectCategoryToShowVoices: "Pilih kategori (tier) di atas untuk menampilkan suara.",
    noVoicesFound: "Tidak ada suara yang ditemukan.",
    noVoicesFoundForTierInLang: "Tidak ada suara untuk {tier} di {lang}.",
  },
  pt: {
    language: "Idioma",
    currentVoice: "Voz atual:",
    clonedSuffix: "(clonada)",
    tier: "Nível:",
    resolved: "Resolvido:",
    foundVoicesInTier: "Encontradas {count} vozes em {tier}.",
    pickCategoryHint: "Escolha uma categoria acima para carregar vozes.",
    tiersLabel: "Níveis:",
    previewPrefix: "Prévia:",
    selectCategoryToShowVoices: "Selecione uma categoria (nível) acima para ver vozes.",
    noVoicesFound: "Nenhuma voz encontrada.",
    noVoicesFoundForTierInLang: "Nenhuma voz encontrada para {tier} em {lang}.",
  },
  fr: {
    language: "Langue",
    currentVoice: "Voix actuelle :",
    clonedSuffix: "(clonée)",
    tier: "Niveau :",
    resolved: "Résolu :",
    foundVoicesInTier: "{count} voix trouvées dans {tier}.",
    pickCategoryHint: "Choisissez une catégorie ci-dessus pour charger les voix.",
    tiersLabel: "Niveaux :",
    previewPrefix: "Aperçu :",
    selectCategoryToShowVoices: "Sélectionnez une catégorie (niveau) ci-dessus pour afficher les voix.",
    noVoicesFound: "Aucune voix trouvée.",
    noVoicesFoundForTierInLang: "Aucune voix trouvée pour {tier} dans {lang}.",
  },
  ru: {
    language: "Язык",
    currentVoice: "Текущий голос:",
    clonedSuffix: "(клон)",
    tier: "Тир:",
    resolved: "Разрешено:",
    foundVoicesInTier: "Найдено {count} голосов в {tier}.",
    pickCategoryHint: "Выберите категорию выше, чтобы загрузить голоса.",
    tiersLabel: "Тиры:",
    previewPrefix: "Предпросмотр:",
    selectCategoryToShowVoices: "Выберите категорию (тир) выше, чтобы показать голоса.",
    noVoicesFound: "Голоса не найдены.",
    noVoicesFoundForTierInLang: "Не найдено голосов для {tier} в {lang}.",
  },
  de: {
    language: "Sprache",
    currentVoice: "Aktuelle Stimme:",
    clonedSuffix: "(geklont)",
    tier: "Tier:",
    resolved: "Aufgelöst:",
    foundVoicesInTier: "{count} Stimmen in {tier} gefunden.",
    pickCategoryHint: "Wähle oben eine Kategorie, um Stimmen zu laden.",
    tiersLabel: "Tiers:",
    previewPrefix: "Vorschau:",
    selectCategoryToShowVoices: "Wähle oben eine Kategorie (Tier), um Stimmen anzuzeigen.",
    noVoicesFound: "Keine Stimmen gefunden.",
    noVoicesFoundForTierInLang: "Keine Stimmen für {tier} in {lang} gefunden.",
  },
} as const satisfies Record<
  Locale,
  {
    language: string;
    currentVoice: string;
    clonedSuffix: string;
    tier: string;
    resolved: string;
    foundVoicesInTier: string;
    pickCategoryHint: string;
    tiersLabel: string;
    previewPrefix: string;
    selectCategoryToShowVoices: string;
    noVoicesFound: string;
    noVoicesFoundForTierInLang: string;
  }
>;

function formatTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
}

const VOICE_PICKER_UI_COPY: Record<
  Locale,
  {
    search: string;
    voiceCategories: string;
    publicVoices: string;
    privateVoices: string;
    loading: string;
    currentVoice: string;
    tier: string;
    resolved: string;
    cloned: string;
  }
> = {
  en: {
    search: "Search",
    voiceCategories: "Voice categories",
    publicVoices: "Public voices",
    privateVoices: "Private voices",
    loading: "Loading…",
    currentVoice: "Current voice",
    tier: "Tier",
    resolved: "Resolved",
    cloned: "cloned",
  },
  zh: {
    search: "搜索",
    voiceCategories: "声音分类",
    publicVoices: "公开声音",
    privateVoices: "私有声音",
    loading: "加载中…",
    currentVoice: "当前音色",
    tier: "档位",
    resolved: "已解析",
    cloned: "克隆",
  },
  ja: {
    search: "検索",
    voiceCategories: "音声カテゴリ",
    publicVoices: "公開音声",
    privateVoices: "プライベート音声",
    loading: "読み込み中…",
    currentVoice: "現在の音声",
    tier: "ティア",
    resolved: "解決後",
    cloned: "クローン",
  },
  es: {
    search: "Buscar",
    voiceCategories: "Categorías de voz",
    publicVoices: "Voces públicas",
    privateVoices: "Voces privadas",
    loading: "Cargando…",
    currentVoice: "Voz actual",
    tier: "Nivel",
    resolved: "Resuelto",
    cloned: "clonada",
  },
  ar: {
    search: "بحث",
    voiceCategories: "فئات الصوت",
    publicVoices: "أصوات عامة",
    privateVoices: "أصوات خاصة",
    loading: "جارٍ التحميل…",
    currentVoice: "الصوت الحالي",
    tier: "الفئة",
    resolved: "المُحوّل",
    cloned: "مستنسخ",
  },
  id: {
    search: "Cari",
    voiceCategories: "Kategori suara",
    publicVoices: "Suara publik",
    privateVoices: "Suara privat",
    loading: "Memuat…",
    currentVoice: "Suara saat ini",
    tier: "Tier",
    resolved: "Terselesaikan",
    cloned: "kloning",
  },
  pt: {
    search: "Pesquisar",
    voiceCategories: "Categorias de voz",
    publicVoices: "Vozes públicas",
    privateVoices: "Vozes privadas",
    loading: "Carregando…",
    currentVoice: "Voz atual",
    tier: "Nível",
    resolved: "Resolvido",
    cloned: "clonada",
  },
  fr: {
    search: "Rechercher",
    voiceCategories: "Catégories de voix",
    publicVoices: "Voix publiques",
    privateVoices: "Voix privées",
    loading: "Chargement…",
    currentVoice: "Voix actuelle",
    tier: "Niveau",
    resolved: "Résolu",
    cloned: "clonée",
  },
  ru: {
    search: "Поиск",
    voiceCategories: "Категории голосов",
    publicVoices: "Публичные голоса",
    privateVoices: "Приватные голоса",
    loading: "Загрузка…",
    currentVoice: "Текущий голос",
    tier: "Тир",
    resolved: "Разрешено",
    cloned: "клон",
  },
  de: {
    search: "Suchen",
    voiceCategories: "Sprachkategorien",
    publicVoices: "Öffentliche Stimmen",
    privateVoices: "Private Stimmen",
    loading: "Wird geladen…",
    currentVoice: "Aktuelle Stimme",
    tier: "Stufe",
    resolved: "Aufgelöst",
    cloned: "geklont",
  },
};

function PremiumCrownIcon({ className }: { className?: string }) {
  return (
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
    >
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </svg>
  );
}

function localeFromPathname(pathname: string): Locale {
  const pathSegments = pathname.split("/").filter(Boolean);
  if (pathSegments.length > 0 && locales.includes(pathSegments[0] as Locale)) {
    return pathSegments[0] as Locale;
  }
  return defaultLocale;
}

function voiceDisplayName(voiceName: string): string {
  // Examples:
  // - en-US-Wavenet-F -> Wavenet F
  // - en-US-Standard-C -> Standard C
  // - en-US-Studio-O -> Studio O
  // - en-US-Chirp3-HD-Umbriel -> Umbriel
  // - Achernar (alias) -> Achernar
  const parts = voiceName.split("-");
  const looksLikeLangPrefix = parts.length >= 3 && parts[0]?.length === 2 && parts[1]?.length === 2;
  const withoutLang = looksLikeLangPrefix ? parts.slice(2).join("-") : voiceName;

  const chirpPrefix = "Chirp3-HD-";
  const idx = withoutLang.indexOf(chirpPrefix);
  if (idx >= 0) {
    const after = withoutLang.slice(idx + chirpPrefix.length);
    if (after) return after.replace(/-/g, " ");
  }

  return withoutLang.replace(/-/g, " ");
}

function voiceAvatarSeed(voiceName: string): string {
  const trimmed = voiceName.trim();
  if (!trimmed) return "voice";

  // Normalize Google-style names to match homepage demo avatar seeds:
  // - en-US-Neural2-F -> en_us_neural2_f
  // - zh-CN-Wavenet-A -> zh_cn_wavenet_a
  const parts = trimmed.split("-").filter(Boolean);
  if (parts.length >= 3 && parts[0]?.length === 2 && parts[1]?.length === 2) {
    const [lang, region, ...rest] = parts;
    const restLower = rest.join("-").toLowerCase();
    const restNormalized = restLower.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

    // Homepage demo uses a generic Chirp3-HD id (no voice-name suffix like "-Umbriel").
    const chirpPrefix = "chirp3_hd";
    const normalizedRestForSeed = restNormalized.startsWith(chirpPrefix) ? chirpPrefix : restNormalized;

    return `${lang.toLowerCase()}_${region.toLowerCase()}_${normalizedRestForSeed}`.replace(/_+/g, "_");
  }

  return trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "voice";
}

function VoiceAvatar({ voiceName, selected }: { voiceName: string; selected: boolean }) {
  const seed = voiceAvatarSeed(voiceName);
  const fallbackSrc = voiceAvatarDataUri(seed, { variant: siteConfig.voiceAvatarVariant });

  return (
    <div
      className={[
        "relative shrink-0 h-16 w-16 rounded-full grid place-items-center bg-white ring-1 shadow-sm",
        selected ? "ring-primary/40" : "ring-border/50 group-hover:ring-primary/30",
      ].join(" ")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fallbackSrc}
        alt={voiceDisplayName(voiceName)}
        className="h-14 w-14 rounded-full object-cover"
        onError={(e) => {
          e.currentTarget.src = "/avatar-placeholder.svg";
        }}
      />
      {selected ? (
        <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background shadow-sm">
          <Check className="h-2.5 w-2.5" />
        </span>
      ) : null}
    </div>
  );
}

function languageOptionLabel(tag: string): string {
  const specialEndonym: Record<string, { displayLocale: string; label: string }> = {
    // Google sometimes returns ISO 639-3 subtags for some Chinese variants.
    cmn: { displayLocale: "zh", label: "普通话" },
    yue: { displayLocale: "zh-Hant", label: "粵語" },
  };

  const parseTag = (): { language: string; region?: string; displayLocale: string } => {
    type IntlLocaleLike = { language?: string; region?: string; script?: string };
    type IntlLocaleCtor = new (tag: string) => IntlLocaleLike;
    const LocaleCtor = (Intl as unknown as { Locale?: IntlLocaleCtor }).Locale;

    if (LocaleCtor) {
      try {
        const parsed = new LocaleCtor(tag);
        const language = (parsed?.language as string) || tag;
        const region = (parsed?.region as string | undefined) || undefined;
        const script = (parsed?.script as string | undefined) || undefined;
        const displayLocale = [language, script, region].filter(Boolean).join("-") || tag;
        return { language, region, displayLocale };
      } catch {
        // ignore
      }
    }

    const parts = tag.split("-").filter(Boolean);
    const language = parts[0] || tag;
    const regionCandidate = parts.find((p) => /^[A-Z]{2}$/.test(p) || /^[0-9]{3}$/.test(p));
    const region = regionCandidate && regionCandidate !== language ? regionCandidate : undefined;
    const displayLocale = region ? `${language}-${region}` : language;
    return { language, region, displayLocale };
  };

  const { language, region, displayLocale } = parseTag();
  const override = specialEndonym[language];
  const localeForNames = override?.displayLocale ?? displayLocale;

  const fullWidthParens = localeForNames.startsWith("zh") || localeForNames.startsWith("ja");
  const openParen = fullWidthParens ? "（" : " (";
  const closeParen = fullWidthParens ? "）" : ")";

  let langName = override?.label;
  if (!langName) {
    try {
      const dnLang = new Intl.DisplayNames([localeForNames], { type: "language" });
      langName = dnLang.of(language) ?? language;
    } catch {
      langName = language;
    }
  }

  if (!region) return `${langName} · ${tag}`;

  try {
    const dnRegion = new Intl.DisplayNames([localeForNames], { type: "region" });
    const regionName = dnRegion.of(region);
    if (regionName) return `${langName}${openParen}${regionName}${closeParen} · ${tag}`;
  } catch {
    // ignore
  }

  return `${langName}${openParen}${region}${closeParen} · ${tag}`;
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function normalizeLang(value: string): string {
  const v = value.trim();
  if (!v) return "en-US";
  return v.slice(0, 32);
}

function voiceLanguageFromName(voiceName: string): string | null {
  const parts = voiceName.split("-");
  if (parts.length < 2) return null;
  if (parts[0]?.length !== 2 || parts[1]?.length !== 2) return null;
  return `${parts[0]}-${parts[1]}`;
}

function pickDefaultVoice(
  voices: VoicesResponse["voices"],
): VoicesResponse["voices"][number] | undefined {
  const tierOrder: Array<VoicesResponse["voices"][number]["billingTier"]> = [
    "standard",
    "wavenet",
    "neural2",
    "studio",
    "chirp3-hd",
  ];

  for (const tier of tierOrder) {
    const found = voices.find((v) => v.billingTier === tier);
    if (found) return found;
  }
  return voices[0];
}

function pickDefaultVoiceForTier(
  voices: VoicesResponse["voices"],
  tier: PublicVoiceTier | null,
): VoicesResponse["voices"][number] | undefined {
  if (!tier || tier === "all") return pickDefaultVoice(voices);
  const inTier = voices.filter((v) => v.billingTier === tier);
  return inTier[0] ?? pickDefaultVoice(voices);
}

export default function GoogleVoicePicker() {
  const isVoiceCloningUiEnabled = process.env.NEXT_PUBLIC_VOICE_CLONING_ENABLED === "1";
  const router = useRouter();
  const pathname = usePathname();
  const locale = useMemo(() => localeFromPathname(pathname || ""), [pathname]);
  const tierHelp = VOICE_TIER_HELP_COPY[locale];
  const labels = VOICE_PICKER_LABEL_COPY[locale];
  const languageUiLabel = labels.language;
  const uiCopy = VOICE_PICKER_UI_COPY[locale];

  const currentVoice = appStore.useState((s) => s.voice);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [selectedMeta, setSelectedMeta] = useState<MetaResponse | null>(null);
  const [isPaidMember, setIsPaidMember] = useState<boolean | null>(null);

  const [clones, setClones] = useState<
    Array<{
      id: string;
      name: string;
      status: string;
      provider: string;
      languageCode?: string;
      modelName?: string | null;
      isDefault: boolean;
    }>
  >([]);
  const [clonesError, setClonesError] = useState<string | null>(null);
  const [clonesLoading, setClonesLoading] = useState(false);

  const [voiceSource, setVoiceSource] = useState<"public" | "private">("public");
  const [publicTier, setPublicTier] = useState<PublicVoiceTier | null>("standard");

  const [lang, setLang] = useState("en-US");
  const [query, setQuery] = useState("");
  const debouncedLang = useDebounced(lang, 250);
  const debouncedQuery = useDebounced(query, 250);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoicesResponse["voices"]>([]);
  const [languages, setLanguages] = useState<LanguagesResponse | null>(null);
  const [manualVoiceByLang, setManualVoiceByLang] = useState<Record<string, string>>({});
  const manualVoiceByLangRef = useRef<Record<string, string>>({});

  useEffect(() => {
    manualVoiceByLangRef.current = manualVoiceByLang;
  }, [manualVoiceByLang]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/membership/status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setIsPaidMember(Boolean(data?.data?.isPaid));
      })
      .catch(() => {
        if (cancelled) return;
        setIsPaidMember(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetch("/api/tts/meta?voice=en-US-Standard-C&format=mp3")
      .then((res) => (res.ok ? (res.json() as Promise<MetaResponse>) : null))
      .then((meta) => setEnabled(meta?.provider === "google"))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (enabled === false && (clones.length > 0 || clonesLoading)) {
      setVoiceSource("private");
    }
  }, [enabled, clones.length, clonesLoading]);

  useEffect(() => {
    if (!isVoiceCloningUiEnabled) {
      setClones([]);
      setClonesError(null);
      setClonesLoading(false);
      return;
    }
    let cancelled = false;
    setClonesLoading(true);
    setClonesError(null);
    fetch("/api/voice-clone", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) return null;
          if (res.status === 501) {
            const text = await res.text().catch(() => "");
            throw new Error(text || "Voice cloning is not enabled.");
          }
          throw new Error(await res.text().catch(() => "Failed to load cloned voices"));
        }
        return (await res.json()) as { clones: typeof clones; maxClones: number };
      })
      .then((data) => {
        if (cancelled) return;
        setClones((data?.clones ?? []).filter((c) => c.status === "ready"));
      })
      .catch((err) => {
        if (cancelled) return;
        setClones([]);
        setClonesError(err instanceof Error ? err.message : "Failed to load cloned voices");
      })
      .finally(() => {
        if (cancelled) return;
        setClonesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isVoiceCloningUiEnabled]);

  useEffect(() => {
    if (enabled !== true) return;
    const inferred = voiceLanguageFromName(appStore.getState().voice);
    if (inferred && lang === "en-US") setLang(inferred);
  }, [enabled, lang]);

  useEffect(() => {
    // Changing the language should not keep an old search filter, otherwise auto-pick becomes confusing.
    setQuery("");
  }, [lang]);

  useEffect(() => {
    if (enabled !== true) return;
    const controller = new AbortController();
    fetch("/api/tts/languages", { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<LanguagesResponse>) : null))
      .then((data) => setLanguages(data))
      .catch(() => setLanguages(null));
    return () => controller.abort();
  }, [enabled]);

  useEffect(() => {
    if (enabled !== true) return;
    const controller = new AbortController();
    fetch(`/api/tts/meta?voice=${encodeURIComponent(currentVoice)}&format=mp3`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<MetaResponse>) : null))
      .then((meta) => setSelectedMeta(meta))
      .catch(() => setSelectedMeta(null));
    return () => controller.abort();
  }, [enabled, currentVoice]);

  const resolvedLang = useMemo(() => normalizeLang(debouncedLang), [debouncedLang]);
  const isAutoMode = !manualVoiceByLang[resolvedLang];

  const limitedVoices = useMemo(
    () => {
      if (!publicTier) return [];
      if (publicTier === "all") return voices;
      return voices.filter((v) => v.billingTier === publicTier);
    },
    [voices, publicTier],
  );
  const staticVoices = useMemo(() => {
    const list = STATIC_PUBLIC_VOICES.filter((v) => v.languageCodes.includes(resolvedLang));
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((v) => v.name.toLowerCase().includes(q) || voiceDisplayName(v.name).toLowerCase().includes(q));
  }, [resolvedLang, debouncedQuery]);
  const limitedStaticVoices = useMemo(() => {
    if (!publicTier) return [];
    if (publicTier === "all") return staticVoices;
    return staticVoices.filter((v) => v.billingTier === publicTier);
  }, [staticVoices, publicTier]);
  const tierCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of voices) {
      counts.set(v.billingTier, (counts.get(v.billingTier) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [voices]);

  function setVoice(voiceName: string) {
    appStore.setState((draft) => {
      draft.voice = voiceName;
      draft.latestAudioUrl = null;
      draft.latestAudioBlobUrl = null;
    });
  }

  useEffect(() => {
    if (enabled !== true) return;
    if (voiceSource !== "public") return;
    if (!publicTier) {
      setLoading(false);
      setError(null);
      setVoices([]);
      return;
    }
    const controller = new AbortController();
    Promise.resolve().then(() => {
      setLoading(true);
      setError(null);
    });

    const url = new URL("/api/tts/voices", window.location.origin);
    url.searchParams.set("lang", resolvedLang);
    if (debouncedQuery.trim()) url.searchParams.set("q", debouncedQuery.trim());

    fetch(url.toString(), { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return (await res.json()) as VoicesResponse;
      })
      .then((data) => {
        const list = (data.voices ?? []).filter((v) => v.billingTier !== "unknown");
        setVoices(list);

        const current = appStore.getState().voice;
        const manual = manualVoiceByLangRef.current[resolvedLang];
        const hasVoice = (name: string) => list.some((v) => v.name === name);

        // If the user has a manual pick for this language, prefer it.
        if (manual && hasVoice(manual) && manual !== current) {
          setVoice(manual);
          return;
        }

        // Otherwise, keep current voice if it's valid for the selected language.
        if (hasVoice(current)) return;

        // Fallback to a safe default voice for the selected language.
        const picked = pickDefaultVoiceForTier(list, publicTier);
        if (picked?.name) setVoice(picked.name);
      })
      .catch((err) => {
        if ((err as { name?: string }).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load voices");
        setVoices([]);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [enabled, resolvedLang, debouncedQuery, voiceSource, publicTier]);

  const currentClone = useMemo(() => {
    const prefix = "clone:";
    if (!currentVoice.startsWith(prefix)) return null;
    const cloneId = currentVoice.slice(prefix.length);
    return clones.find((c) => c.id === cloneId) ?? null;
  }, [clones, currentVoice]);

  const hasStaticPublicVoices = STATIC_PUBLIC_VOICES.some((v) => v.languageCodes.includes(resolvedLang));
  const hasPublicVoices = enabled !== false || hasStaticPublicVoices;

  const pricingHref = useMemo(() => {
    const locale = localeFromPathname(pathname || "");
    return `/${locale}/pricing`;
  }, [pathname]);

  const premiumLocked = isPaidMember !== true;

  return (
    <div className="mt-3 flex flex-col h-full min-h-0">
      <div className="mb-3 flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setVoiceSource("public")}
          className={[
            "inline-flex h-9 items-center rounded-full border px-4 text-sm transition-colors",
            voiceSource === "public"
              ? "border-foreground/40 bg-foreground/10 text-foreground"
              : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground",
          ].join(" ")}
          aria-pressed={voiceSource === "public"}
          disabled={!hasPublicVoices}
        >
          {uiCopy.publicVoices}
        </button>
        <button
          type="button"
          onClick={() => setVoiceSource("private")}
          className={[
            "inline-flex h-9 items-center rounded-full border px-4 text-sm transition-colors",
            voiceSource === "private"
              ? "border-foreground/40 bg-foreground/10 text-foreground"
              : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground",
          ].join(" ")}
          aria-pressed={voiceSource === "private"}
        >
          {uiCopy.privateVoices}
        </button>
      </div>

	      {voiceSource === "public" && enabled === null && clones.length === 0 && !clonesError ? (
	        <div className="flex flex-col gap-3 shrink-0">
	          <div className="flex flex-col gap-2">
	            <div className="text-xs text-muted-foreground">{languageUiLabel}</div>
	            <Skeleton className="h-9 w-full rounded-xl" />
	            <div className="text-xs text-muted-foreground">{uiCopy.search}</div>
	            <Skeleton className="h-9 w-full rounded-xl" />
	          </div>
	          <Skeleton className="h-9 w-full rounded-xl" />
	          <div className="mt-3 flex-1 min-h-0 max-h-[500px] overflow-y-auto rounded-xl border border-border bg-muted/20 shadow-inner">
            <div className="p-3 grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }).map((_, idx) => (
                <div
                  key={`voice-init-skeleton-${idx}`}
                  className="w-full flex flex-col items-center gap-2 rounded-lg p-2"
                >
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {voiceSource === "private" ? (
        clonesLoading && clones.length === 0 && !clonesError ? (
          <div className="rounded-xl border border-border bg-muted/20 shadow-inner p-3 mb-3 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground">{uiCopy.privateVoices}</div>
              <div className="text-[11px] text-muted-foreground">{uiCopy.loading}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={`private-voice-skeleton-${idx}`}
                  className="w-full rounded-lg border border-border bg-background/60 px-3 py-2"
                >
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-2 h-3 w-20 opacity-70" />
                </div>
              ))}
            </div>
          </div>
        ) : clones.length > 0 ? (
          <div className="rounded-xl border border-border bg-muted/20 shadow-inner p-3 mb-3 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground">{uiCopy.privateVoices}</div>
              <div className="text-[11px] text-muted-foreground">
                {clones.length}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {clones.slice(0, 6).map((c) => {
                const selected = currentClone?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={[
                      "w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                      selected
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-background/60 text-muted-foreground hover:text-foreground hover:bg-background/80",
                    ].join(" ")}
                    onClick={() => setVoice(`clone:${c.id}`)}
                    title={c.languageCode || undefined}
                  >
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-[10px] opacity-70 truncate">
                      {c.isDefault ? "Default" : "Cloned voice"} · {c.provider}
                    </div>
                  </button>
                );
              })}
            </div>
            {clonesError ? (
              <div className="mt-2 text-xs text-red-600 whitespace-pre-wrap">{clonesError}</div>
            ) : null}
          </div>
        ) : clonesError ? (
          <div className="rounded-xl border border-border bg-muted/20 shadow-inner p-3 mb-3 shrink-0">
            <div className="text-xs text-muted-foreground">{uiCopy.privateVoices}</div>
            <div className="mt-1 text-xs text-red-600 whitespace-pre-wrap">{clonesError}</div>
          </div>
        ) : null
      ) : null}

      {voiceSource === "public" ? (
        enabled ? (
          <div className="flex flex-col gap-3 shrink-0">
            <div className="flex flex-col gap-2">
              <label className="text-xs text-muted-foreground">
                {languageUiLabel}{languages?.count ? ` (${languages.count})` : ""}
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                >
                  {(languages?.languages?.length ? languages.languages : [lang]).map((code) => (
                    <option key={code} value={code}>
                      {languageOptionLabel(code)}
                    </option>
                  ))}
                </select>
              </label>
	              <div className="flex flex-row gap-2">
	                <label className="text-xs text-muted-foreground flex-1">
	                  {uiCopy.search}
	                  <input
	                    value={query}
	                    onChange={(e) => setQuery(e.target.value)}
	                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
	                    placeholder="wavenet / studio / chirp"
                  />
                </label>
              </div>
	            </div>

	            <div className="rounded-xl border border-border bg-muted/20 shadow-inner p-3">
	              <div className="text-xs font-medium text-foreground/80">{uiCopy.voiceCategories}</div>
	              <div className="mt-2 flex flex-wrap gap-2">
	                {[
	                  { id: "standard", label: "standard", premium: false },
	                  { id: "wavenet", label: "wavenet", premium: true },
                  { id: "neural2", label: "Neural2", premium: true },
                  { id: "chirp3-hd", label: "Chirp3-HD", premium: true },
                  { id: "studio", label: "studio", premium: true },
                  { id: "all", label: "All", premium: true },
                ].map((t) => {
                  const isSelected = publicTier === (t.id as PublicVoiceTier);
                  const disabled = !hasPublicVoices;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (t.premium && premiumLocked) {
                          router.push(pricingHref);
                          return;
                        }
                        setPublicTier(t.id as PublicVoiceTier);
                      }}
                      className={[
                        "inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm transition-colors",
                        disabled ? "opacity-60 cursor-not-allowed" : "",
                        isSelected
                          ? "border-foreground/40 bg-foreground/10 text-foreground"
                          : "border-border bg-background/60 text-muted-foreground hover:bg-background/80 hover:text-foreground",
                      ].join(" ")}
                      aria-pressed={isSelected}
                      title={t.premium && premiumLocked ? "Paid members only" : undefined}
                    >
                      {t.premium ? <PremiumCrownIcon className="h-4 w-4" /> : null}
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
                  {tierHelp.summary}
                </summary>
                <div className="mt-2 text-[11px] leading-4 text-muted-foreground">
                  <ul className="space-y-1">
                    <li>
                      <span className="font-mono text-foreground/80">standard</span>
                      {tierHelp.separator}
                      {tierHelp.standard}
                    </li>
                    <li>
                      <span className="font-mono text-foreground/80">wavenet</span>
                      {tierHelp.separator}
                      {tierHelp.wavenet}
                    </li>
                    <li>
                      <span className="font-mono text-foreground/80">Neural2</span>
                      {tierHelp.separator}
                      {tierHelp.neural2}
                    </li>
                    <li>
                      <span className="font-mono text-foreground/80">Chirp3-HD</span>
                      {tierHelp.separator}
                      {tierHelp.chirp3Hd}
                    </li>
                    <li>
                      <span className="font-mono text-foreground/80">studio</span>
                      {tierHelp.separator}
                      {tierHelp.studio}
                    </li>
                    <li>
                      <span className="font-mono text-foreground/80">All</span>
                      {tierHelp.separator}
                      {tierHelp.all}
                    </li>
                    <li className="pt-1">
                      {tierHelp.pricingNote}
                    </li>
                  </ul>
                </div>
              </details>
            </div>

            <Button
              variant={isAutoMode ? "default" : "outline"}
              onClick={() => {
                setManualVoiceByLang((prev) => {
                  if (!prev[resolvedLang]) return prev;
                  const next = { ...prev };
                  delete next[resolvedLang];
                  return next;
                });
                const picked = pickDefaultVoiceForTier(voices, publicTier);
                if (picked?.name) setVoice(picked.name);
              }}
              className="w-full justify-center"
              disabled={!publicTier}
            >
              <span className="relative inline-flex items-center">{publicTier ? "Auto pick" : "Pick a category first"}</span>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 shrink-0">
            <div className="text-xs text-muted-foreground">
              Voice list preview (no API). Showing a static set of voices for layout only.
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-muted-foreground">
                {languageUiLabel}
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                >
                  {STATIC_LANGUAGE_OPTIONS.map((code) => (
                    <option key={code} value={code}>
                      {languageOptionLabel(code)}
                    </option>
                  ))}
                </select>
              </label>
	              <div className="flex flex-row gap-2">
	                <label className="text-xs text-muted-foreground flex-1">
	                  {uiCopy.search}
	                  <input
	                    value={query}
	                    onChange={(e) => setQuery(e.target.value)}
	                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
	                    placeholder="wavenet / studio / chirp"
                  />
                </label>
              </div>
	            </div>

	            <div className="rounded-xl border border-border bg-muted/20 shadow-inner p-3">
	              <div className="text-xs font-medium text-foreground/80">{uiCopy.voiceCategories}</div>
	              <div className="mt-2 flex flex-wrap gap-2">
	                {[
	                  { id: "standard", label: "standard", premium: false },
	                  { id: "wavenet", label: "wavenet", premium: true },
                  { id: "neural2", label: "Neural2", premium: true },
                  { id: "chirp3-hd", label: "Chirp3-HD", premium: true },
                  { id: "studio", label: "studio", premium: true },
                  { id: "all", label: "All", premium: true },
                ].map((t) => {
                  const isSelected = publicTier === (t.id as PublicVoiceTier);
                  const disabled = !hasPublicVoices;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => setPublicTier(t.id as PublicVoiceTier)}
                      className={[
                        "inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm transition-colors",
                        disabled ? "opacity-60 cursor-not-allowed" : "",
                        isSelected
                          ? "border-foreground/40 bg-foreground/10 text-foreground"
                          : "border-border bg-background/60 text-muted-foreground hover:bg-background/80 hover:text-foreground",
                      ].join(" ")}
                      aria-pressed={isSelected}
                    >
                      {t.premium ? <PremiumCrownIcon className="h-4 w-4" /> : null}
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )
      ) : null}

      <div className="mt-2 text-xs text-muted-foreground shrink-0">
        {labels.currentVoice}{" "}
        <span className="font-mono text-foreground">
          {currentClone ? `${currentClone.name} ${labels.clonedSuffix}` : currentVoice}
        </span>
        {selectedMeta?.billingTier ? (
          <>
            {" "}
            · {labels.tier} <span className="font-mono text-foreground">{selectedMeta.billingTier}</span>
          </>
        ) : null}
        {selectedMeta?.voiceName && selectedMeta.voiceName !== currentVoice ? (
          <>
            {" "}
            · {labels.resolved} <span className="font-mono text-foreground">{selectedMeta.voiceName}</span>
          </>
      ) : null}
      </div>
      {voiceSource === "public" && enabled ? (
        <>
          <div className="mt-1 text-xs text-muted-foreground shrink-0">
            {publicTier ? (
              <>
                {formatTemplate(labels.foundVoicesInTier, {
                  count: limitedVoices.length,
                  tier: publicTier === "all" ? "All" : publicTier,
                })}{" "}
              </>
            ) : (
              <>{labels.pickCategoryHint}{" "}</>
            )}
            {tierCounts.length > 0 && (
              <>
                {labels.tiersLabel}{" "}
                {tierCounts
                  .slice(0, 6)
                  .map(([tier, count]) => `${tier} ${count}`)
                  .join(", ")}
                {tierCounts.length > 6 ? "…" : ""}.
              </>
            )}
          </div>

          <div className="mt-3 flex-1 min-h-0 max-h-[500px] overflow-y-auto rounded-xl border border-border bg-muted/20 shadow-inner">
            {!publicTier ? (
              <div className="p-6 text-sm text-muted-foreground text-center">{labels.selectCategoryToShowVoices}</div>
            ) : loading ? (
              <div className="p-3 grid grid-cols-3 gap-2">
                {Array.from({ length: 12 }).map((_, idx) => (
                  <div
                    key={`voice-skeleton-${idx}`}
                    className="w-full flex flex-col items-center gap-2 rounded-lg p-2"
                  >
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-4 text-sm text-red-600 whitespace-pre-wrap">{error}</div>
            ) : voices.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">{labels.noVoicesFound}</div>
            ) : limitedVoices.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                {formatTemplate(labels.noVoicesFoundForTierInLang, { tier: publicTier, lang: resolvedLang })}
              </div>
            ) : (
              <div className="p-3 grid grid-cols-3 gap-2">
                {limitedVoices.map((v) => {
                  const label = `${v.name} (${v.billingTier}${v.billingTierSource === "heuristic" ? "?" : ""})`;
                  const selected = v.name === currentVoice;
                  const displayName = voiceDisplayName(v.name);
                  return (
                    <button
                      key={v.name}
                      type="button"
                      className={[
                        "group w-full flex flex-col items-center gap-2 rounded-lg p-2 transition-all",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        selected
                          ? "bg-primary/10 shadow-sm"
                          : "hover:bg-background/80",
                      ].join(" ")}
                      onClick={() => {
                        setManualVoiceByLang((prev) => ({ ...prev, [resolvedLang]: v.name }));
                        setVoice(v.name);
                      }}
                      title={label}
                    >
                      <VoiceAvatar voiceName={v.name} selected={selected} />
                      <div className="min-w-0 w-full text-center">
                        <div className={["text-[11px] font-medium leading-tight truncate", selected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"].join(" ")}>
                          {displayName}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}

      {voiceSource === "public" && enabled === false ? (
        <>
          <div className="mt-1 text-xs text-muted-foreground shrink-0">
            {publicTier ? (
              <>
                {labels.previewPrefix}{" "}
                {formatTemplate(labels.foundVoicesInTier, {
                  count: limitedStaticVoices.length,
                  tier: publicTier === "all" ? "All" : publicTier,
                })}{" "}
              </>
            ) : (
              <>{labels.pickCategoryHint}{" "}</>
            )}
          </div>

          <div className="mt-3 flex-1 min-h-0 max-h-[500px] overflow-y-auto rounded-xl border border-border bg-muted/20 shadow-inner">
            {!publicTier ? (
              <div className="p-6 text-sm text-muted-foreground text-center">{labels.selectCategoryToShowVoices}</div>
            ) : limitedStaticVoices.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">{labels.noVoicesFound}</div>
            ) : (
              <div className="p-3 grid grid-cols-3 gap-2">
                {limitedStaticVoices.map((v) => {
                  const label = `${v.name} (${v.billingTier})`;
                  const selected = v.name === currentVoice;
                  const displayName = voiceDisplayName(v.name);
                  return (
                    <button
                      key={v.name}
                      type="button"
                      className={[
                        "group w-full flex flex-col items-center gap-2 rounded-lg p-2 transition-all",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        selected ? "bg-primary/10 shadow-sm" : "hover:bg-background/80",
                      ].join(" ")}
                      onClick={() => {
                        setManualVoiceByLang((prev) => ({ ...prev, [resolvedLang]: v.name }));
                        setVoice(v.name);
                      }}
                      title={label}
                    >
                      <VoiceAvatar voiceName={v.name} selected={selected} />
                      <div className="min-w-0 w-full text-center">
                        <div className={["text-[11px] font-medium leading-tight truncate", selected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"].join(" ")}>
                          {displayName}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
