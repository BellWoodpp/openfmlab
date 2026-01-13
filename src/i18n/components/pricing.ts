import type { Locale } from "@/i18n/types";

export interface PricingCopy {
  header: {
    title: string;
    subtitle: string;
    yearlyDiscount: string;
  };
  card: {
    popular: string;
    veryPopular: string;
    getStarted: string;
    currentPlan: string;
    owned: string;
    switchToMonthly: string;
    switchToYearly: string;
    buyNow: string;
    contactSales: string;
    included: string;
    limitations: string;
    save: string;
    loading: string;
    processing: string;
  };
  billingToggle: {
    discount: string;
  };
}

const pricingCopy: Record<Locale, PricingCopy> = {
  en: {
    header: {
      title: "Pricing Plans",
      subtitle:
        "Unlock premium voices and higher quality tiers for RTVox text to speech. Upgrade anytime.",
      yearlyDiscount: "Save 20% with yearly billing compared to monthly billing",
    },
    card: {
      popular: "Popular",
      veryPopular: "Very Popular",
      getStarted: "Get Started",
      currentPlan: "Your current plan",
      owned: "Included",
      switchToMonthly: "Switch to monthly",
      switchToYearly: "Switch to yearly",
      buyNow: "Buy Now",
      contactSales: "Contact Sales",
      included: "Included Features",
      limitations: "Limitations",
      save: "Save",
      loading: "Loading...",
      processing: "Processing...",
    },
    billingToggle: {
      discount: "20% OFF",
    },
  },
  zh: {
    header: {
      title: "价格方案",
      subtitle: "解锁 RTVox 的高级音色与更高质量的语音层级，随时升级。",
      yearlyDiscount: "年付享受 20% 优惠，相比月付节省更多费用",
    },
    card: {
      popular: "推荐",
      veryPopular: "超热门",
      getStarted: "开始使用",
      currentPlan: "您当前的套餐",
      owned: "已拥有",
      switchToMonthly: "切换为月付",
      switchToYearly: "升级为年付",
      buyNow: "立即购买",
      contactSales: "联系销售",
      included: "包含功能",
      limitations: "限制说明",
      save: "节省",
      loading: "载入中...",
      processing: "处理中...",
    },
    billingToggle: {
      discount: "20% 折扣",
    },
  },
  ja: {
    header: {
      title: "料金プラン",
      subtitle:
        "RTVoxのプレミアム音声と高品質ティアを解放。いつでもアップグレードできます。",
      yearlyDiscount: "年払いで月払いと比較して20%お得",
    },
    card: {
      popular: "人気",
      veryPopular: "超人気",
      getStarted: "始める",
      currentPlan: "現在のプラン",
      owned: "利用可能",
      switchToMonthly: "月額に切り替え",
      switchToYearly: "年額に切り替え",
      buyNow: "今すぐ購入",
      contactSales: "営業に連絡",
      included: "含まれる機能",
      limitations: "制限事項",
      save: "節約",
      loading: "読み込み中...",
      processing: "処理中...",
    },
    billingToggle: {
      discount: "20% 割引",
    },
  },
  es: {
    header: {
      title: "Planes de precios",
      subtitle:
        "Precios simples y transparentes sin cargos ocultos. Elige el plan que mejor se adapte a tus necesidades y actualiza cuando quieras.",
      yearlyDiscount: "Ahorra un 20% con facturación anual frente a la mensual",
    },
    card: {
      popular: "Popular",
      veryPopular: "Muy popular",
      getStarted: "Empezar",
      currentPlan: "Tu plan actual",
      owned: "Incluido",
      switchToMonthly: "Cambiar a mensual",
      switchToYearly: "Cambiar a anual",
      buyNow: "Comprar ahora",
      contactSales: "Contactar a ventas",
      included: "Funciones incluidas",
      limitations: "Limitaciones",
      save: "Ahorra",
      loading: "Cargando...",
      processing: "Procesando...",
    },
    billingToggle: {
      discount: "20% DTO.",
    },
  },
  ar: {
    header: {
      title: "خطط التسعير",
      subtitle:
        "تسعير بسيط وشفاف دون رسوم مخفية. اختر الخطة التي تناسب احتياجاتك ويمكنك الترقية في أي وقت.",
      yearlyDiscount: "وفر 20٪ مع الفوترة السنوية مقارنةً بالفوترة الشهرية",
    },
    card: {
      popular: "الأكثر شيوعًا",
      veryPopular: "شائع جدًا",
      getStarted: "ابدأ الآن",
      currentPlan: "خطتك الحالية",
      owned: "مضمن",
      switchToMonthly: "التبديل إلى شهري",
      switchToYearly: "التبديل إلى سنوي",
      buyNow: "اشتر الآن",
      contactSales: "تواصل مع المبيعات",
      included: "الميزات المتضمنة",
      limitations: "القيود",
      save: "وفر",
      loading: "جارٍ التحميل...",
      processing: "جاري المعالجة...",
    },
    billingToggle: {
      discount: "خصم 20٪",
    },
  },
  id: {
    header: {
      title: "Paket harga",
      subtitle:
        "Harga sederhana dan transparan tanpa biaya tersembunyi. Pilih paket yang paling sesuai dengan kebutuhan Anda, tingkatkan kapan saja.",
      yearlyDiscount: "Hemat 20% dengan penagihan tahunan dibanding bulanan",
    },
    card: {
      popular: "Populer",
      veryPopular: "Sangat populer",
      getStarted: "Mulai sekarang",
      currentPlan: "Paket Anda saat ini",
      owned: "Termasuk",
      switchToMonthly: "Ganti ke bulanan",
      switchToYearly: "Ganti ke tahunan",
      buyNow: "Beli sekarang",
      contactSales: "Hubungi sales",
      included: "Fitur yang disertakan",
      limitations: "Batasan",
      save: "Hemat",
      loading: "Memuat...",
      processing: "Memproses...",
    },
    billingToggle: {
      discount: "Diskon 20%",
    },
  },
  pt: {
    header: {
      title: "Planos de preços",
      subtitle:
        "Preços simples e transparentes, sem taxas ocultas. Escolha o plano que melhor atende às suas necessidades e faça upgrade a qualquer momento.",
      yearlyDiscount: "Economize 20% com faturamento anual em comparação ao mensal",
    },
    card: {
      popular: "Popular",
      veryPopular: "Muito popular",
      getStarted: "Começar agora",
      currentPlan: "Seu plano atual",
      owned: "Incluído",
      switchToMonthly: "Mudar para mensal",
      switchToYearly: "Mudar para anual",
      buyNow: "Comprar agora",
      contactSales: "Fale com vendas",
      included: "Recursos incluídos",
      limitations: "Limitações",
      save: "Economize",
      loading: "Carregando...",
      processing: "Processando...",
    },
    billingToggle: {
      discount: "20% OFF",
    },
  },
  fr: {
    header: {
      title: "Forfaits tarifaires",
      subtitle:
        "Des tarifs simples et transparents sans frais cachés. Choisissez le forfait qui correspond le mieux à vos besoins et passez à l'offre supérieure quand vous le souhaitez.",
      yearlyDiscount: "Économisez 20 % avec la facturation annuelle par rapport à la mensuelle",
    },
    card: {
      popular: "Populaire",
      veryPopular: "Très populaire",
      getStarted: "Commencer",
      currentPlan: "Votre offre actuelle",
      owned: "Inclus",
      switchToMonthly: "Passer au mensuel",
      switchToYearly: "Passer à l’annuel",
      buyNow: "Acheter maintenant",
      contactSales: "Contacter les ventes",
      included: "Fonctionnalités incluses",
      limitations: "Limitations",
      save: "Économisez",
      loading: "Chargement...",
      processing: "Traitement...",
    },
    billingToggle: {
      discount: "-20 %",
    },
  },
  ru: {
    header: {
      title: "Тарифные планы",
      subtitle:
        "Простое и прозрачное ценообразование без скрытых платежей. Выберите тариф, который лучше всего подходит вам, и обновляйте его в любое время.",
      yearlyDiscount: "Экономьте 20% при ежегодной оплате по сравнению с ежемесячной",
    },
    card: {
      popular: "Популярный",
      veryPopular: "Очень популярный",
      getStarted: "Начать",
      currentPlan: "Ваш текущий тариф",
      owned: "Включено",
      switchToMonthly: "Перейти на ежемесячный",
      switchToYearly: "Перейти на ежегодный",
      buyNow: "Купить сейчас",
      contactSales: "Связаться с отделом продаж",
      included: "Включенные функции",
      limitations: "Ограничения",
      save: "Экономия",
      loading: "Загрузка...",
      processing: "Обработка...",
    },
    billingToggle: {
      discount: "Скидка 20%",
    },
  },
  de: {
    header: {
      title: "Preispläne",
      subtitle:
        "Einfache und transparente Preise ohne versteckte Gebühren. Wähle den Plan, der am besten zu deinen Bedürfnissen passt, und upgrade jederzeit.",
      yearlyDiscount: "Spare 20 % mit jährlicher Abrechnung im Vergleich zur monatlichen",
    },
    card: {
      popular: "Beliebt",
      veryPopular: "Sehr beliebt",
      getStarted: "Jetzt starten",
      currentPlan: "Dein aktueller Plan",
      owned: "Enthalten",
      switchToMonthly: "Zu monatlich wechseln",
      switchToYearly: "Zu jährlich wechseln",
      buyNow: "Jetzt kaufen",
      contactSales: "Vertrieb kontaktieren",
      included: "Enthaltene Funktionen",
      limitations: "Einschränkungen",
      save: "Sparen",
      loading: "Lädt...",
      processing: "Wird verarbeitet...",
    },
    billingToggle: {
      discount: "20 % RABATT",
    },
  },
};

export function getPricingCopy(locale: Locale): PricingCopy {
  return pricingCopy[locale] ?? pricingCopy.en;
}
