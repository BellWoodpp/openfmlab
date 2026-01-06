import { NextRequest, NextResponse } from "next/server";
// crypto 是 Node.js 内置的核心模块（不需要安装）
// createHmac 是专门用来生成 HMAC-SHA256 签名 的函数（目前 99% 的支付平台都用这个算法）
// 作用：把“支付平台发来的数据” + “我们自己的秘钥” 混合计算出一个“指纹”（签名）
// 然后跟支付平台发来的签名对比：
// 一样 → 是真的通知，可以发货、改订单状态
// 不一样 → 假的！直接丢掉，防止黑客伪造支付成功
// 生活比喻：就像快递员送货时要你签收 + 核对身份证。
import { createHmac } from "crypto";
// 这是一个你项目自己写的“订单服务层”
// 里面通常有这些方法：TypeScriptfulfillOrder(orderId)        // 发货、送虚拟商品、开通会员
// updateOrderStatus(orderId, "paid")
// sendThankYouEmail(orderId)
// 一旦签名验证通过，就会调用这些方法真正“完成订单”
import { OrderService } from "@/lib/orders/service";

// Creem 事件类型定义
// interface:类型结构定义，接口
interface CreemEvent {
  eventType: string;
  data: unknown;
}

interface CreemCustomer {
  email?: string;
}

interface CreemProduct {
  id?: string;
}

interface CreemCheckoutData {
  requestId: string;
  customer?: CreemCustomer;
  product?: CreemProduct;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  reason?: string;
}

interface CreemSubscriptionData {
  subscriptionId: string;
  customer?: CreemCustomer;
  product?: CreemProduct;
  metadata?: Record<string, unknown>;
  reason?: string;
}

// Creem 支付回调处理
export async function POST(request: NextRequest) {
  try {
    // 获取请求体的原始文本，signature:签名，payload:有效载荷
    const payload = await request.text();
    // ||：OR的逻辑运算符
    const signature = request.headers.get('creem-signature') || request.headers.get('x-creem-signature');

    console.log('Creem callback received:', {
      hasSignature: !!signature,
      payloadLength: payload.length,
      headers: Object.fromEntries(request.headers.entries())
    });

    // 验证签名（如果配置了 webhook secret）
    const webhookSecret = process.env.CREEM_WEBHOOK_SECRET;
    // &&：AND逻辑运算符
    if (webhookSecret && signature) {
      const hmac = createHmac('sha256', webhookSecret);
      hmac.update(payload);
      const computedSignature = hmac.digest('hex');
      
      if (computedSignature !== signature) {
        console.error('Signature verification failed:', {
          expected: computedSignature,
          received: signature
        });
        return NextResponse.json({ error: '签名验证失败' }, { status: 400 });
      }
    }

    // 解析事件数据
    const event = JSON.parse(payload);
    console.log('Creem event:', event);

    // 根据事件类型处理
    const result = await handleCreemEvent(event);
    
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('处理 Creem Webhook 时发生错误：', error);
    return NextResponse.json({ 
      error: '服务器内部错误',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// 处理 Creem 事件
async function handleCreemEvent(event: CreemEvent) {
  const { eventType, data } = event;
  
  console.log(`处理 Creem 事件: ${eventType}`, data);

  // switch 是 JavaScript / TypeScript 里的一种流程控制语句，中文叫 “开关语句” 或 “多分支选择语句”
  switch (eventType) {
    // case:当变量等于这个值的时候
    case 'checkout.completed':
//       as 是 TypeScript 独有的语法，叫 类型断言（type assertion）
// 意思是：“我（程序员）保证 data 一定是一个 CreemCheckoutData 类型，你 TypeScript 别报错了，相信我！”
      return await handleCheckoutCompleted(data as CreemCheckoutData);
    
    case 'checkout.failed':
      return await handleCheckoutFailed(data as CreemCheckoutData);
    
    case 'subscription.active':
      return await handleSubscriptionActive(data as CreemSubscriptionData);
    
    case 'subscription.cancelled':
      return await handleSubscriptionCancelled(data as CreemSubscriptionData);
    
    case 'subscription.expired':
      return await handleSubscriptionExpired(data as CreemSubscriptionData);
    
    default:
      console.log(`未处理的事件类型：${eventType}`);
      return { status: 'ignored', eventType };
  }
}

// 处理一次性支付完成
async function handleCheckoutCompleted(data: CreemCheckoutData) {
  console.log('处理一次性支付完成事件:', data);
  
  // product:产品，amount:数量，currency:货币，
  const { 
    requestId, 
    customer, 
    product, 
    amount, 
    currency,
    metadata 
  } = data;

  // 更新订单状态为已支付
  const order = await OrderService.handlePaymentSuccess(requestId);
  
  if (!order) {
    console.error('支付成功但订单未找到:', {
      requestId,
      customerEmail: customer?.email,
    });
    return {
      status: 'error',
      action: 'checkout_completed',
      requestId,
      message: '订单未找到',
    };
  }

  // 记录支付成功日志
  console.log('支付成功:', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    requestId,
    customerEmail: customer?.email,
    productId: product?.id,
    amount,
    currency,
    metadata
  });

  return {
    status: 'success',
    action: 'checkout_completed',
    orderId: order.id,
    orderNumber: order.orderNumber,
    requestId,
    message: '支付成功处理完成',
    redirectUrl: metadata?.locale ? `/${metadata.locale}/payment/success` : '/payment/success'
  };
}

// 处理支付失败
async function handleCheckoutFailed(data: CreemCheckoutData) {
  console.log('处理支付失败事件:', data);
  
  const { 
    requestId, 
    customer, 
    product, 
    reason 
  } = data;

  // 更新订单状态为失败
  const order = await OrderService.handlePaymentFailed(requestId);
  
  if (!order) {
    console.error('支付失败但订单未找到:', {
      requestId,
      customerEmail: customer?.email,
    });
    return {
      status: 'error',
      action: 'checkout_failed',
      requestId,
      message: '订单未找到',
    };
  }
  
  console.log('支付失败:', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    requestId,
    customerEmail: customer?.email,
    productId: product?.id,
    reason
  });

  return {
    status: 'failed',
    action: 'checkout_failed',
    orderId: order.id,
    orderNumber: order.orderNumber,
    requestId,
    message: '支付失败处理完成',
    redirectUrl: '/payment/failed'
  };
}

// 处理订阅激活，Subscription:订阅
async function handleSubscriptionActive(data: CreemSubscriptionData) {
  console.log('处理订阅激活事件:', data);
  
  const { 
    subscriptionId, 
    customer, 
    product, 
    metadata 
  } = data;

  // 对于订阅激活，我们可能需要查找相关的订单
  // 这里可以根据订阅ID或其他标识符来更新订单状态
  console.log('订阅激活:', {
    subscriptionId,
    customerEmail: customer?.email,
    productId: product?.id,
    metadata
  });

  return {
    status: 'success',
    action: 'subscription_active',
    subscriptionId,
    message: '订阅激活处理完成'
  };
}

// 处理订阅取消
async function handleSubscriptionCancelled(data: CreemSubscriptionData) {
  console.log('处理订阅取消事件:', data);
  
  const { 
    subscriptionId, 
    customer, 
    reason 
  } = data;

  // TODO: 这里可以添加订阅取消逻辑
  // 例如：更新用户订阅状态、发送取消确认邮件等
  
  console.log('订阅取消:', {
    subscriptionId,
    customerEmail: customer?.email,
    reason
  });

  return {
    status: 'cancelled',
    action: 'subscription_cancelled',
    subscriptionId,
    message: '订阅取消处理完成'
  };
}

// 处理订阅过期
async function handleSubscriptionExpired(data: CreemSubscriptionData) {
  console.log('处理订阅过期事件:', data);
  
  const { 
    subscriptionId, 
    customer 
  } = data;

  // TODO: 这里可以添加订阅过期逻辑
  // 例如：更新用户订阅状态、发送续费提醒等
  
  console.log('订阅过期:', {
    subscriptionId,
    customerEmail: customer?.email
  });

  return {
    status: 'expired',
    action: 'subscription_expired',
    subscriptionId,
    message: '订阅过期处理完成'
  };
}

// 支持 GET 请求用于测试
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get('locale') || 'en';
  
  return NextResponse.json({
    message: 'Creem callback endpoint is working',
    locale,
    timestamp: new Date().toISOString()
  });
}

// POST（） handleCreemEvent