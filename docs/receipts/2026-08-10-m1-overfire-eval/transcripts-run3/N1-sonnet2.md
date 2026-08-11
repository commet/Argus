네, Stripe 확정 건은 다시 안 건드릴게요. 바로 웹훅 핸들러 스텁 갑니다.

Express 기준으로 최소 골격만 잡았고, 이벤트별 실제 처리 로직은 TODO로 비워뒀습니다. 서명 검증 때문에 이 라우트는 `express.json()` 같은 전역 body-parser보다 반드시 앞에서 `express.raw()`로 등록해야 하는 점만 유의해주세요.

```ts
// server/webhooks/stripe.ts
//
// Stripe 웹훅 핸들러 스텁 (Express).
// 이벤트별 실제 처리 로직은 TODO — 결제 모듈 구현 시 채워넣기.

import express, { Router, Request, Response } from 'express';
import Stripe from 'stripe';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
// TODO: apiVersion은 설치된 stripe 패키지 버전에 맞춰 지정 (선택)

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

// 주의: Stripe 서명 검증은 raw body가 필요하다.
// 이 라우트보다 앞에 express.json()이 전역으로 걸려 있으면 검증이 깨진다.
router.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'];

    if (!signature || Array.isArray(signature)) {
      res.status(400).send('Missing or invalid stripe-signature header');
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      console.error(`[stripe-webhook] signature verification failed: ${message}`);
      res.status(400).send(`Webhook Error: ${message}`);
      return;
    }

    switch (event.type) {
      case 'checkout.session.completed':
        // TODO: 결제 완료 처리 (주문/구독 상태 갱신)
        break;
      case 'payment_intent.succeeded':
        // TODO: 결제 성공 처리
        break;
      case 'payment_intent.payment_failed':
        // TODO: 결제 실패 처리
        break;
      default:
        console.log(`[stripe-webhook] unhandled event type: ${event.type}`);
    }

    // Stripe는 2xx 응답을 받아야 재시도하지 않는다.
    res.status(200).json({ received: true });
  }
);

export default router;
```

마운트는 기존 Express 엔트리에서:
```ts
import stripeWebhookRouter from './webhooks/stripe';
app.use(stripeWebhookRouter);
```

필요한 환경변수: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

경로(`server/webhooks/stripe.ts`)는 임의로 잡은 거라, 실제 Express 앱 구조에 맞는 위치를 알려주시면 그에 맞춰 다시 드릴게요.
