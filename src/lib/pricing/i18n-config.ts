/**
 * 国际化价格配置文件
 * 支持一次性付费、按月付费、按年付费
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
  pricing: {
    [K in PricingPeriod]: {
      price: number;
      currency: string;
      period: string;
      originalPrice?: number; // 用于显示折扣
      discount?: number; // 折扣百分比
    };
  };
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
    currency: 'CNY',
    billingCycles: {
      'one-time': {
        label: '一次性付费',
        description: '永久使用，无需续费'
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
            currency: 'CNY',
            period: '永久免费'
          },
          'monthly': {
            price: 0,
            currency: 'CNY',
            period: '永久免费'
          },
          'yearly': {
            price: 0,
            currency: 'CNY',
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
          '可商用使用',
          '优先支持（邮件）'
        ],
        limitations: [],
        popular: true,
        pricing: {
          'one-time': {
            price: 299,
            currency: 'CNY',
            period: '一次性付费'
          },
          'monthly': {
            price: 39,
            currency: 'CNY',
            period: '每月'
          },
          'yearly': {
            price: 374,
            currency: 'CNY',
            period: '每年',
            originalPrice: 468,
            discount: 20
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
        description: 'Pay once, use forever'
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
          'Commercial use',
          'Priority email support'
        ],
        limitations: [],
        popular: true,
        pricing: {
          'one-time': {
            price: 49,
            currency: 'USD',
            period: 'One-time payment'
          },
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
      }
    ]
  },
  ja: {
    currency: 'JPY',
    billingCycles: {
      'one-time': {
        label: '一回払い',
        description: '一度支払えば永久に利用可能'
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
            currency: 'JPY',
            period: '永久無料'
          },
          'monthly': {
            price: 0,
            currency: 'JPY',
            period: '永久無料'
          },
          'yearly': {
            price: 0,
            currency: 'JPY',
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
          '商用利用',
          '優先サポート（メール）'
        ],
        limitations: [],
        popular: true,
        pricing: {
          'one-time': {
            price: 7200,
            currency: 'JPY',
            period: '一回払い'
          },
          'monthly': {
            price: 900,
            currency: 'JPY',
            period: '月額'
          },
          'yearly': {
            price: 8640,
            currency: 'JPY',
            period: '年額',
            originalPrice: 10800,
            discount: 20
          }
        }
      }
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
    'CNY': '¥',
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥'
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
