export type RefundLocale = string;

export type RefundCopy = {
  button: {
    requestRefund: string;
    refundRequested: string;
  };
  tooltips: {
    alreadyRequested: string;
    notRefundable: string;
    notPaid: string;
  };
  panel: {
    title: string;
    calculating: string;
    estimatedNet: string;
    originalAmount: string;
    refundableBeforeFee: string;
    fee: string;
    feeHelpAria: string;
    feeHelpText: string;
    estimatedNetLine: string;
    agreeLabel: string;
    submit: string;
    submitting: string;
    submitted: string;
    note: string;
    details: {
      tokensPurchased: string;
      refundableTokens: string;
      availableTokens: string;
      refundableCredits: string;
      availableCredits: string;
    };
  };
  terms: {
    title: string;
    bullets: string[];
    tip: string;
  };
};

type SupportedLocale = "en" | "zh" | "ja" | "es" | "ar" | "id" | "pt" | "fr" | "ru" | "de";

function normalize(locale: RefundLocale): SupportedLocale {
  const l = (locale || "en").toLowerCase();
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("ja")) return "ja";
  if (l.startsWith("es")) return "es";
  if (l.startsWith("ar")) return "ar";
  if (l.startsWith("id")) return "id";
  if (l.startsWith("pt")) return "pt";
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("ru")) return "ru";
  if (l.startsWith("de")) return "de";
  return "en";
}

const copy: Record<SupportedLocale, RefundCopy> = {
  en: {
    button: { requestRefund: "Cancel / Refund", refundRequested: "Refund requested" },
    tooltips: {
      alreadyRequested: "Refund already requested",
      notRefundable: "This product is not refundable",
      notPaid: "Only paid orders can be refunded",
    },
    panel: {
      title: "Cancellation / Refund request",
      calculating: "Calculating refund estimate...",
      estimatedNet: "Estimated",
      originalAmount: "Original amount",
      refundableBeforeFee: "Refundable (before fee)",
      fee: "Fee",
      feeHelpAria: "Why is there a fee?",
      feeHelpText: "Refunds may incur processing costs required by our payment provider (Creem). This fee helps cover those costs.",
      estimatedNetLine: "Estimated net refund (final may differ)",
      agreeLabel: "I have read and agree to the terms above",
      submit: "Confirm cancellation & submit",
      submitting: "Submitting...",
      submitted: "Submitted",
      note: "We’ll attempt to stop renewal (if applicable). Refunds may require manual review.",
      details: {
        tokensPurchased: "Tokens granted (this purchase)",
        refundableTokens: "Refundable tokens (this purchase)",
        availableTokens: "Available tokens",
        refundableCredits: "Refundable credits (this order)",
        availableCredits: "Available credits",
      },
    },
    terms: {
      title: "Cancellation / Refund Terms (summary)",
      bullets: [
        "After you submit a request, we will attempt to stop renewal (if applicable) and review the refund.",
        "Professional (monthly/yearly): tokens are granted upfront; refunds are prorated by remaining refundable tokens from this purchase, minus a processing fee; base free tokens are non-refundable.",
        "Credits Station: refunds are prorated by remaining refundable credits from this purchase, minus a processing fee; base free credits are non-refundable.",
        "Refund requests may require manual review. Final results may differ.",
      ],
      tip: "",
    },
  },
  zh: {
    button: { requestRefund: "退订/退款", refundRequested: "已提交退款" },
    tooltips: {
      alreadyRequested: "已提交退款申请",
      notRefundable: "该商品不支持退款",
      notPaid: "仅已支付订单可申请退款",
    },
    panel: {
      title: "退订 / 退款申请",
      calculating: "正在计算退款预估...",
      estimatedNet: "预估可退",
      originalAmount: "订单金额",
      refundableBeforeFee: "可退金额（扣费前）",
      fee: "手续费",
      feeHelpAria: "为什么要手续费？",
      feeHelpText: "退款会产生支付渠道（Creem）要求的处理成本/手续费，我们收取该费用用于覆盖成本。",
      estimatedNetLine: "预计到账（最终以实际为准）",
      agreeLabel: "我已阅读并同意以上条款",
      submit: "确认退订并提交申请",
      submitting: "提交中...",
      submitted: "已提交",
      note: "提交后会尝试停止续费（如适用），退款可能需要人工审核。",
      details: {
        tokensPurchased: "本次购买发放 Token",
        refundableTokens: "本次可退 Token",
        availableTokens: "当前可用 Token",
        refundableCredits: "本单可退积分",
        availableCredits: "当前可用积分",
      },
    },
    terms: {
      title: "退订/退款条款（摘要）",
      bullets: [
        "提交申请后，我们会尝试停止续费（如适用）并按规则审核退款。",
        "专业版（月付/年付）：购买后一次性发放 Token；退款按本次购买剩余可退 Token 折算并扣除手续费；基础赠送 Token 不参与退款。",
        "积分加油站：退款按本次充值剩余可退积分折算并扣除手续费；基础赠送积分不参与退款。",
        "退款申请可能需要人工审核；最终结果以实际处理为准。",
      ],
      tip: "",
    },
  },
  ja: {
    button: { requestRefund: "解約/返金", refundRequested: "返金申請済み" },
    tooltips: {
      alreadyRequested: "返金は申請済みです",
      notRefundable: "この商品は返金対象外です",
      notPaid: "支払い済みの注文のみ返金申請できます",
    },
    panel: {
      title: "解約 / 返金申請",
      calculating: "返金見積もりを計算中…",
      estimatedNet: "見積もり",
      originalAmount: "注文金額",
      refundableBeforeFee: "返金可能（手数料前）",
      fee: "手数料",
      feeHelpAria: "手数料の理由",
      feeHelpText: "返金には決済プロバイダー（Creem）による処理コストが発生する場合があります。この手数料はそのコストを補うためのものです。",
      estimatedNetLine: "入金見込み（最終結果は異なる場合あり）",
      agreeLabel: "上記の規約を読み同意します",
      submit: "解約して申請する",
      submitting: "送信中…",
      submitted: "送信済み",
      note: "可能な場合は自動更新を停止します。返金は手動審査になる場合があります。",
      details: {
        tokensPurchased: "付与トークン（今回）",
        refundableTokens: "返金対象トークン（今回）",
        availableTokens: "利用可能トークン",
        refundableCredits: "返金対象クレジット（本注文）",
        availableCredits: "利用可能クレジット",
      },
    },
    terms: {
      title: "解約/返金規約（要約）",
      bullets: [
        "申請後、可能な場合は自動更新を停止し、返金を審査します。",
        "Professional（月額/年額）：購入時にトークンが一括付与されます。返金はこの購入分の残り返金対象トークンに応じて按分し、手数料を差し引きます。無料/基本付与分は返金対象外です。",
        "Credits Station：この購入分の残り返金対象クレジットに応じて按分し、手数料を差し引きます。無料/基本付与分は返金対象外です。",
        "返金申請は手動審査になる場合があります。最終結果は異なる場合があります。",
      ],
      tip: "",
    },
  },
  es: {
    button: { requestRefund: "Cancelar / Reembolso", refundRequested: "Reembolso solicitado" },
    tooltips: {
      alreadyRequested: "El reembolso ya fue solicitado",
      notRefundable: "Este producto no admite reembolso",
      notPaid: "Solo los pedidos pagados pueden reembolsarse",
    },
    panel: {
      title: "Solicitud de cancelación / reembolso",
      calculating: "Calculando estimación de reembolso...",
      estimatedNet: "Estimado",
      originalAmount: "Importe original",
      refundableBeforeFee: "Reembolsable (antes de comisión)",
      fee: "Comisión",
      feeHelpAria: "¿Por qué hay comisión?",
      feeHelpText: "Los reembolsos pueden generar costes de procesamiento exigidos por nuestro proveedor de pagos (Creem). Esta comisión ayuda a cubrirlos.",
      estimatedNetLine: "Reembolso neto estimado (puede variar)",
      agreeLabel: "He leído y acepto los términos anteriores",
      submit: "Confirmar cancelación y enviar",
      submitting: "Enviando...",
      submitted: "Enviado",
      note: "Intentaremos detener la renovación (si aplica). Puede requerir revisión manual.",
      details: {
        tokensPurchased: "Tokens otorgados (esta compra)",
        refundableTokens: "Tokens reembolsables (esta compra)",
        availableTokens: "Tokens disponibles",
        refundableCredits: "Créditos reembolsables (este pedido)",
        availableCredits: "Créditos disponibles",
      },
    },
    terms: {
      title: "Términos de cancelación/reembolso (resumen)",
      bullets: [
        "Tras enviar la solicitud, intentaremos detener la renovación (si aplica) y revisaremos el reembolso.",
        "Professional (mensual/anual): los tokens se otorgan por adelantado; el reembolso se prorratea según los tokens reembolsables restantes de esta compra, menos comisión; los tokens base gratuitos no son reembolsables.",
        "Credits Station: el reembolso se prorratea según los créditos reembolsables restantes de esta compra, menos comisión; los créditos base gratuitos no son reembolsables.",
        "Puede requerir revisión manual. El resultado final puede variar.",
      ],
      tip: "",
    },
  },
  ar: {
    button: { requestRefund: "إلغاء / استرداد", refundRequested: "تم طلب الاسترداد" },
    tooltips: {
      alreadyRequested: "تم طلب الاسترداد بالفعل",
      notRefundable: "هذا المنتج غير قابل للاسترداد",
      notPaid: "يمكن استرداد الطلبات المدفوعة فقط",
    },
    panel: {
      title: "طلب إلغاء / استرداد",
      calculating: "جارٍ حساب تقدير الاسترداد...",
      estimatedNet: "تقدير",
      originalAmount: "المبلغ الأصلي",
      refundableBeforeFee: "قابل للاسترداد (قبل الرسوم)",
      fee: "رسوم",
      feeHelpAria: "لماذا توجد رسوم؟",
      feeHelpText: "قد تترتب على عمليات الاسترداد تكاليف معالجة يطلبها مزود الدفع لدينا (Creem). تساعد هذه الرسوم في تغطية تلك التكاليف.",
      estimatedNetLine: "صافي الاسترداد التقديري (قد يختلف)",
      agreeLabel: "قرأت الشروط أعلاه وأوافق عليها",
      submit: "تأكيد الإلغاء وإرسال الطلب",
      submitting: "جارٍ الإرسال...",
      submitted: "تم الإرسال",
      note: "سنحاول إيقاف التجديد (إن أمكن). قد يتطلب الاسترداد مراجعة يدوية.",
      details: {
        tokensPurchased: "الرموز الممنوحة (هذه العملية)",
        refundableTokens: "الرموز القابلة للاسترداد (هذه العملية)",
        availableTokens: "الرموز المتاحة",
        refundableCredits: "الأرصدة القابلة للاسترداد (لهذا الطلب)",
        availableCredits: "الأرصدة المتاحة",
      },
    },
    terms: {
      title: "شروط الإلغاء/الاسترداد (ملخص)",
      bullets: [
        "بعد إرسال الطلب، سنحاول إيقاف التجديد (إن أمكن) ومراجعة الاسترداد.",
        "Professional (شهري/سنوي): يتم منح الرموز مسبقًا؛ يُحتسب الاسترداد بنسبة الرموز القابلة للاسترداد المتبقية من هذه العملية مع خصم الرسوم؛ الرموز الأساسية المجانية غير قابلة للاسترداد.",
        "Credits Station: يُحتسب الاسترداد بنسبة الأرصدة القابلة للاسترداد المتبقية من هذه العملية مع خصم الرسوم؛ الأرصدة الأساسية المجانية غير قابلة للاسترداد.",
        "قد يتطلب الأمر مراجعة يدوية وقد يختلف القرار النهائي.",
      ],
      tip: "",
    },
  },
  id: {
    button: { requestRefund: "Batalkan / Refund", refundRequested: "Refund diminta" },
    tooltips: {
      alreadyRequested: "Refund sudah diminta",
      notRefundable: "Produk ini tidak dapat direfund",
      notPaid: "Hanya pesanan berbayar yang bisa direfund",
    },
    panel: {
      title: "Permintaan pembatalan / refund",
      calculating: "Menghitung estimasi refund...",
      estimatedNet: "Estimasi",
      originalAmount: "Jumlah awal",
      refundableBeforeFee: "Dapat direfund (sebelum biaya)",
      fee: "Biaya",
      feeHelpAria: "Kenapa ada biaya?",
      feeHelpText: "Refund dapat dikenakan biaya pemrosesan yang diwajibkan oleh penyedia pembayaran kami (Creem). Biaya ini membantu menutup biaya tersebut.",
      estimatedNetLine: "Estimasi refund bersih (hasil akhir bisa berbeda)",
      agreeLabel: "Saya sudah membaca dan menyetujui ketentuan di atas",
      submit: "Konfirmasi batal & kirim",
      submitting: "Mengirim...",
      submitted: "Terkirim",
      note: "Kami akan mencoba menghentikan perpanjangan (jika berlaku). Mungkin perlu peninjauan manual.",
      details: {
        tokensPurchased: "Token diberikan (pembelian ini)",
        refundableTokens: "Token yang dapat direfund (pembelian ini)",
        availableTokens: "Token tersedia",
        refundableCredits: "Kredit yang dapat direfund (pesanan ini)",
        availableCredits: "Kredit tersedia",
      },
    },
    terms: {
      title: "Syarat pembatalan/refund (ringkas)",
      bullets: [
        "Setelah dikirim, kami akan mencoba menghentikan perpanjangan (jika berlaku) dan meninjau refund.",
        "Professional (bulanan/tahunan): token diberikan di awal; refund diprorata berdasarkan sisa token yang dapat direfund dari pembelian ini, dikurangi biaya; token dasar gratis tidak dapat direfund.",
        "Credits Station: refund diprorata berdasarkan sisa kredit yang dapat direfund dari pembelian ini, dikurangi biaya; kredit dasar gratis tidak dapat direfund.",
        "Permintaan refund dapat memerlukan peninjauan manual. Hasil akhir bisa berbeda.",
      ],
      tip: "",
    },
  },
  pt: {
    button: { requestRefund: "Cancelar / Reembolso", refundRequested: "Reembolso solicitado" },
    tooltips: {
      alreadyRequested: "Reembolso já solicitado",
      notRefundable: "Este produto não é reembolsável",
      notPaid: "Apenas pedidos pagos podem ser reembolsados",
    },
    panel: {
      title: "Solicitação de cancelamento / reembolso",
      calculating: "Calculando estimativa de reembolso...",
      estimatedNet: "Estimado",
      originalAmount: "Valor original",
      refundableBeforeFee: "Reembolsável (antes da taxa)",
      fee: "Taxa",
      feeHelpAria: "Por que há taxa?",
      feeHelpText: "Reembolsos podem ter custos de processamento exigidos pelo nosso provedor de pagamentos (Creem). Esta taxa ajuda a cobrir esses custos.",
      estimatedNetLine: "Reembolso líquido estimado (pode variar)",
      agreeLabel: "Li e concordo com os termos acima",
      submit: "Confirmar cancelamento e enviar",
      submitting: "Enviando...",
      submitted: "Enviado",
      note: "Tentaremos parar a renovação (se aplicável). Pode exigir revisão manual.",
      details: {
        tokensPurchased: "Tokens concedidos (esta compra)",
        refundableTokens: "Tokens reembolsáveis (esta compra)",
        availableTokens: "Tokens disponíveis",
        refundableCredits: "Créditos reembolsáveis (este pedido)",
        availableCredits: "Créditos disponíveis",
      },
    },
    terms: {
      title: "Termos de cancelamento/reembolso (resumo)",
      bullets: [
        "Após o envio, tentaremos parar a renovação (se aplicável) e revisar o reembolso.",
        "Professional (mensal/anual): os tokens são concedidos antecipadamente; o reembolso é proporcional aos tokens reembolsáveis restantes desta compra, menos taxa; tokens base gratuitos não são reembolsáveis.",
        "Credits Station: o reembolso é proporcional aos créditos reembolsáveis restantes desta compra, menos taxa; créditos base gratuitos não são reembolsáveis.",
        "Pode exigir revisão manual. O resultado final pode variar.",
      ],
      tip: "",
    },
  },
  fr: {
    button: { requestRefund: "Annuler / Remboursement", refundRequested: "Remboursement demandé" },
    tooltips: {
      alreadyRequested: "Remboursement déjà demandé",
      notRefundable: "Ce produit n’est pas remboursable",
      notPaid: "Seules les commandes payées peuvent être remboursées",
    },
    panel: {
      title: "Demande d’annulation / remboursement",
      calculating: "Calcul de l’estimation du remboursement...",
      estimatedNet: "Estimation",
      originalAmount: "Montant initial",
      refundableBeforeFee: "Remboursable (avant frais)",
      fee: "Frais",
      feeHelpAria: "Pourquoi des frais ?",
      feeHelpText: "Les remboursements peuvent entraîner des frais de traitement requis par notre prestataire de paiement (Creem). Ces frais aident à couvrir ces coûts.",
      estimatedNetLine: "Remboursement net estimé (peut varier)",
      agreeLabel: "J’ai lu et j’accepte les conditions ci-dessus",
      submit: "Confirmer et envoyer",
      submitting: "Envoi...",
      submitted: "Envoyé",
      note: "Nous tenterons d’arrêter le renouvellement (si applicable). Une vérification manuelle peut être requise.",
      details: {
        tokensPurchased: "Tokens attribués (cet achat)",
        refundableTokens: "Tokens remboursables (cet achat)",
        availableTokens: "Tokens disponibles",
        refundableCredits: "Crédits remboursables (cette commande)",
        availableCredits: "Crédits disponibles",
      },
    },
    terms: {
      title: "Conditions d’annulation/remboursement (résumé)",
      bullets: [
        "Après soumission, nous tenterons d’arrêter le renouvellement (si applicable) et d’examiner le remboursement.",
        "Professional (mensuel/annuel) : les tokens sont attribués à l’avance ; le remboursement est proratisé selon les tokens remboursables restants de cet achat, moins des frais ; les tokens de base gratuits ne sont pas remboursables.",
        "Credits Station : le remboursement est proratisé selon les crédits remboursables restants de cet achat, moins des frais ; les crédits de base gratuits ne sont pas remboursables.",
        "La demande peut nécessiter une vérification manuelle. Le résultat final peut varier.",
      ],
      tip: "",
    },
  },
  ru: {
    button: { requestRefund: "Отмена / Возврат", refundRequested: "Запрошен возврат" },
    tooltips: {
      alreadyRequested: "Возврат уже запрошен",
      notRefundable: "Этот продукт не подлежит возврату",
      notPaid: "Возврат возможен только для оплаченных заказов",
    },
    panel: {
      title: "Запрос отмены / возврата",
      calculating: "Расчёт суммы возврата...",
      estimatedNet: "Оценка",
      originalAmount: "Исходная сумма",
      refundableBeforeFee: "К возврату (до комиссии)",
      fee: "Комиссия",
      feeHelpAria: "Почему взимается комиссия?",
      feeHelpText: "Возврат может сопровождаться затратами на обработку, требуемыми платежным провайдером (Creem). Комиссия помогает покрыть эти расходы.",
      estimatedNetLine: "Оценка возврата (может отличаться)",
      agreeLabel: "Я прочитал(а) и согласен(на) с условиями выше",
      submit: "Подтвердить и отправить",
      submitting: "Отправка...",
      submitted: "Отправлено",
      note: "Мы попробуем остановить продление (если применимо). Может потребоваться ручная проверка.",
      details: {
        tokensPurchased: "Начисленные токены (эта покупка)",
        refundableTokens: "Возвратные токены (эта покупка)",
        availableTokens: "Доступные токены",
        refundableCredits: "Возвратные кредиты (этот заказ)",
        availableCredits: "Доступные кредиты",
      },
    },
    terms: {
      title: "Условия отмены/возврата (кратко)",
      bullets: [
        "После отправки мы попробуем остановить продление (если применимо) и рассмотрим возврат.",
        "Professional (месячная/годовая): токены начисляются заранее; возврат рассчитывается пропорционально оставшимся возвратным токенам этой покупки минус комиссия; базовые бесплатные токены не возвращаются.",
        "Credits Station: возврат рассчитывается пропорционально оставшимся возвратным кредитам этой покупки минус комиссия; базовые бесплатные кредиты не возвращаются.",
        "Запрос может требовать ручной проверки. Итог может отличаться.",
      ],
      tip: "",
    },
  },
  de: {
    button: { requestRefund: "Kündigen / Erstattung", refundRequested: "Erstattung angefragt" },
    tooltips: {
      alreadyRequested: "Erstattung wurde bereits angefragt",
      notRefundable: "Dieses Produkt ist nicht erstattungsfähig",
      notPaid: "Nur bezahlte Bestellungen können erstattet werden",
    },
    panel: {
      title: "Kündigungs- / Erstattungsanfrage",
      calculating: "Erstattungs-Schätzung wird berechnet...",
      estimatedNet: "Geschätzt",
      originalAmount: "Ursprungsbetrag",
      refundableBeforeFee: "Erstattbar (vor Gebühr)",
      fee: "Gebühr",
      feeHelpAria: "Warum gibt es eine Gebühr?",
      feeHelpText: "Rückerstattungen können Verarbeitungskosten verursachen, die von unserem Zahlungsanbieter (Creem) verlangt werden. Diese Gebühr hilft, diese Kosten zu decken.",
      estimatedNetLine: "Geschätzte Erstattung (kann abweichen)",
      agreeLabel: "Ich habe die Bedingungen gelesen und stimme zu",
      submit: "Bestätigen & senden",
      submitting: "Wird gesendet...",
      submitted: "Gesendet",
      note: "Wir versuchen die Verlängerung zu stoppen (falls zutreffend). Manuelle Prüfung möglich.",
      details: {
        tokensPurchased: "Tokens gutgeschrieben (dieser Kauf)",
        refundableTokens: "Erstattbare Tokens (dieser Kauf)",
        availableTokens: "Verfügbare Tokens",
        refundableCredits: "Erstattbare Credits (diese Bestellung)",
        availableCredits: "Verfügbare Credits",
      },
    },
    terms: {
      title: "Kündigungs-/Erstattungsbedingungen (Kurzfassung)",
      bullets: [
        "Nach dem Absenden versuchen wir die Verlängerung zu stoppen (falls zutreffend) und prüfen die Erstattung.",
        "Professional (monatlich/jährlich): Tokens werden im Voraus gutgeschrieben; die Erstattung wird nach verbleibenden erstattbaren Tokens dieses Kaufs anteilig berechnet, abzüglich Gebühr; kostenlose Basis-Tokens sind nicht erstattbar.",
        "Credits Station: die Erstattung wird nach verbleibenden erstattbaren Credits dieses Kaufs anteilig berechnet, abzüglich Gebühr; kostenlose Basis-Credits sind nicht erstattbar.",
        "Erstattungen können eine manuelle Prüfung erfordern. Endergebnis kann abweichen.",
      ],
      tip: "",
    },
  },
};

export function getRefundCopy(locale: RefundLocale): RefundCopy {
  return copy[normalize(locale)] ?? copy.en;
}
