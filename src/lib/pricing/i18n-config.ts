/**
 * 国际化价格配置文件
 * 支持订阅（月付/年付）与单次支付（积分充值）
 */

import { type Locale } from "@/i18n/types";

const FALLBACK_LOCALE: Locale = "en";

export type PricingPeriod = 'one-time' | 'monthly' | 'yearly';

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  features: string[];
  limitations?: string[];
  popular?: boolean;
  pricing: Partial<
    Record<
      PricingPeriod,
      {
        price: number;
        currency: string;
        period: string;
        originalPrice?: number; // 用于显示折扣
        discount?: number; // 折扣百分比
      }
    >
  >;
}

export interface PricingConfig {
  currency: string;
  plans: PricingPlan[];
  billingCycles: {
    [K in PricingPeriod]: {
      label: string;
      description: string;
      discount?: string; // 年付折扣说明
    };
  };
}

// 国际化价格配置
export const pricingConfigs: Partial<Record<Locale, PricingConfig>> = {
  zh: {
    currency: 'USD',
    billingCycles: {
      'one-time': {
        label: '单次支付',
        description: '一次性支付（用于积分充值）'
      },
      'monthly': {
        label: '按月付费',
        description: '灵活付费，随时取消'
      },
      'yearly': {
        label: '按年付费',
        description: '年付优惠 20%'
      }
    },
    plans: [
      {
        id: 'free',
        name: '免费版',
        description: '适合体验 RTVox 的标准音色与基础功能',
        features: [
          '标准音色（Standard）',
          '语气/语速/音量基础控制',
          'MP3 导出与分享',
          '生成历史记录'
        ],
        limitations: [
          '高级音色（WaveNet/Neural2/Chirp3-HD/Studio）需付费会员',
          '语音克隆仅对付费会员开放（功能开启时）'
        ],
        popular: false,
        pricing: {
          'one-time': {
            price: 0,
            currency: 'USD',
            period: '永久免费'
          },
          'monthly': {
            price: 0,
            currency: 'USD',
            period: '永久免费'
          },
          'yearly': {
            price: 0,
            currency: 'USD',
            period: '永久免费'
          }
        }
      },
      {
        id: 'professional',
        name: '专业版',
        description: '适合创作者与团队，解锁高级音色与更高质量',
        features: [
          '包含免费版全部功能',
          '解锁高级音色：WaveNet / Neural2 / Chirp3-HD / Studio',
          '[[pro_tokens]] [[coins]]',
          '专属会员样式（徽章/身份标识） [[crown]]',
          '可商用使用',
          '优先支持（邮件）'
        ],
        limitations: [],
        popular: true,
        pricing: {
          'monthly': {
            price: 6,
            currency: 'USD',
            period: '每月'
          },
          'yearly': {
            price: 58,
            currency: 'USD',
            period: '每年',
            originalPrice: 72,
            discount: 20
          }
        }
      },
      {
        id: 'points',
        name: '积分加油站',
        description: '购买 Token（积分）用于语音生成，按量扣减，用完再充',
        features: [
          '每 $3 增加 100,000 Tokens [[coins]]',
          '多档位 Token（积分）包可选',
          '适用于 Standard / 高级音色生成',
          '可与会员叠加使用',
          '查看余额与消耗明细'
        ],
        limitations: [
          '不包含高级音色解锁（高级音色需会员）'
        ],
        popular: false,
        pricing: {
          'one-time': {
            price: 3,
            currency: 'USD',
            period: '起'
          },
          'monthly': {
            price: 3,
            currency: 'USD',
            period: '起'
          },
          'yearly': {
            price: 3,
            currency: 'USD',
            period: '起'
          }
        }
      },
    ]
  },
  en: {
    currency: 'USD',
    billingCycles: {
      'one-time': {
        label: 'One-time Payment',
        description: 'Single payment (credits top-up)'
      },
      'monthly': {
        label: 'Monthly',
        description: 'Flexible billing, cancel anytime'
      },
      'yearly': {
        label: 'Yearly',
        description: 'Save 20% with annual billing'
      }
    },
    plans: [
      {
        id: 'free',
        name: 'Free',
        description: 'Try RTVox with Standard voices and essential controls',
        features: [
          'Standard voice tier',
          'Tone/speed/volume basics',
          'MP3 export & sharing',
          'Generation history'
        ],
        limitations: [
          'Premium tiers (WaveNet/Neural2/Chirp3-HD/Studio) require paid membership',
          'Voice cloning is paid-only (when enabled)'
        ],
        popular: false,
        pricing: {
          'one-time': {
            price: 0,
            currency: 'USD',
            period: 'Free forever'
          },
          'monthly': {
            price: 0,
            currency: 'USD',
            period: 'Free forever'
          },
          'yearly': {
            price: 0,
            currency: 'USD',
            period: 'Free forever'
          }
        }
      },
      {
        id: 'professional',
        name: 'Professional',
        description: 'Unlock premium voice tiers for creators and teams',
        features: [
          'Everything in Free',
          'Premium tiers: WaveNet / Neural2 / Chirp3-HD / Studio',
          '[[pro_tokens]] [[coins]]',
          'Exclusive member style [[crown]]',
          'Commercial use',
          'Priority email support'
        ],
        limitations: [],
        popular: true,
        pricing: {
          'monthly': {
            price: 6,
            currency: 'USD',
            period: 'per month'
          },
          'yearly': {
            price: 58,
            currency: 'USD',
            period: 'per year',
            originalPrice: 72,
            discount: 20
          }
        }
      },
      {
        id: 'points',
        name: 'Credits Station',
        description: 'Top up credits for speech generation. Pay as you go and refill anytime.',
        features: [
          'Every $3 adds 100,000 Tokens [[coins]]',
          'Multiple credit packs available',
          'Works with Standard & premium voices',
          'Can be used together with membership',
          'Track balance and usage history'
        ],
        limitations: [
          'Does not unlock premium voice tiers (membership required)'
        ],
        popular: false,
        pricing: {
          'one-time': {
            price: 3,
            currency: 'USD',
            period: '+'
          },
          'monthly': {
            price: 3,
            currency: 'USD',
            period: '+'
          },
          'yearly': {
            price: 3,
            currency: 'USD',
            period: '+'
          }
        }
      },
    ]
  },
  ja: {
    currency: 'USD',
    billingCycles: {
      'one-time': {
        label: '一回払い',
        description: '単発の支払い（クレジットチャージ用）'
      },
      'monthly': {
        label: '月払い',
        description: '柔軟な支払い、いつでもキャンセル可能'
      },
      'yearly': {
        label: '年払い',
        description: '年払いで20%割引'
      }
    },
    plans: [
      {
        id: 'free',
        name: '無料版',
        description: 'RTVoxを標準音声と基本機能でお試し',
        features: [
          '標準音声（Standard）',
          'トーン/速度/音量の基本調整',
          'MP3書き出し・共有',
          '生成履歴'
        ],
        limitations: [
          'プレミアム音声（WaveNet/Neural2/Chirp3-HD/Studio）は有料',
          '音声クローンは有料（機能有効時）'
        ],
        popular: false,
        pricing: {
          'one-time': {
            price: 0,
            currency: 'USD',
            period: '永久無料'
          },
          'monthly': {
            price: 0,
            currency: 'USD',
            period: '永久無料'
          },
          'yearly': {
            price: 0,
            currency: 'USD',
            period: '永久無料'
          }
        }
      },
      {
        id: 'professional',
        name: 'プロフェッショナル版',
        description: 'プレミアム音声ティアを解放し、高品質な読み上げに',
        features: [
          '無料版のすべて',
          'プレミアム音声：WaveNet / Neural2 / Chirp3-HD / Studio',
          '毎月 200,000 トークン付与 [[coins]]',
          '会員限定スタイル（バッジ/表示） [[crown]]',
          '商用利用',
          '優先サポート（メール）'
        ],
        limitations: [],
        popular: true,
        pricing: {
          'monthly': {
            price: 6,
            currency: 'USD',
            period: '月額'
          },
          'yearly': {
            price: 58,
            currency: 'USD',
            period: '年額',
            originalPrice: 72,
            discount: 20
          }
        }
      },
      {
        id: 'points',
        name: 'ポイント補給所',
        description: '音声生成に使えるクレジットをチャージ。使った分だけ消費し、いつでも追加できます。',
        features: [
          '$3 ごとに 100,000 トークン追加 [[coins]]',
          '複数のクレジットパックを用意',
          '標準/プレミアム音声の生成に対応',
          '会員プランと併用可能',
          '残高と利用履歴を確認'
        ],
        limitations: [
          'プレミアム音声ティアの解放は含まれません（会員が必要）'
        ],
        popular: false,
        pricing: {
          'one-time': {
            price: 3,
            currency: 'USD',
            period: '〜'
          },
          'monthly': {
            price: 3,
            currency: 'USD',
            period: '〜'
          },
          'yearly': {
            price: 3,
            currency: 'USD',
            period: '〜'
          }
        }
      },
    ]
  }
};

const fallbackPricingConfig = pricingConfigs[FALLBACK_LOCALE]!;

// 获取指定语言的价格配置
export function getPricingConfig(locale: Locale): PricingConfig {
  return pricingConfigs[locale] ?? fallbackPricingConfig;
}

// 获取指定周期的价格
export function getPricingForPeriod(planId: string, period: PricingPeriod, locale: Locale = 'en') {
  const config = getPricingConfig(locale);
  const plan = config.plans.find(p => p.id === planId);
  return plan?.pricing[period];
}

// 获取所有周期的价格
export function getAllPricingForPlan(planId: string, locale: Locale = 'en') {
  const config = getPricingConfig(locale);
  const plan = config.plans.find(p => p.id === planId);
  return plan?.pricing;
}

// 获取推荐的价格周期（年付优先）
export function getRecommendedPeriod(): PricingPeriod {
  // Temporarily disable one-time payments in UI; default to monthly.
  return 'monthly';
}

// 计算年付节省金额
export function calculateYearlySavings(monthlyPrice: number): number {
  const yearlyPrice = monthlyPrice * 12;
  const discountedYearlyPrice = yearlyPrice * 0.8; // 20% 折扣
  return yearlyPrice - discountedYearlyPrice;
}

// 格式化价格显示
export function formatPrice(price: number, currency: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
  };
  
  const symbol = symbols[currency] || currency;
  return `${symbol}${price}`;
}

// 获取价格周期标签
export function getPeriodLabel(period: PricingPeriod, locale: Locale = 'en'): string {
  const config = getPricingConfig(locale);
  return config.billingCycles[period].label;
}

// 获取价格周期描述
export function getPeriodDescription(period: PricingPeriod, locale: Locale = 'en'): string {
  const config = getPricingConfig(locale);
  return config.billingCycles[period].description;
}
