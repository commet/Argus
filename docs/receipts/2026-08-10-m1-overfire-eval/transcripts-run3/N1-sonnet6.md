네, Stripe 확정 건은 다시 꺼내지 않을게요.

바로 스텁 만들어뒀습니다. Express 라우터 기준이고, 실제 마운트 경로는 서버 구조에 맞춰 조정하시면 됩니다.

```ts
// webhooks/stripe.ts
import express, { Router, Request, Response } from 'express';

const router = Router();

// Stripe 서명 검증에는 raw body가 필요합니다.
// 전역 express.json()보다 앞에 마운트하거나, 이 경로에만 express.raw()를 적용하세요.
router.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'];

    // TODO: stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
    // 로 서명 검증 후 event 파싱

    // TODO: event.type 분기
    // switch (event.type) {
    //   case 'checkout.session.completed':
    //   case 'invoice.payment_succeeded':
    //   case 'customer.subscription.updated':
    //   case 'customer.subscription.deleted':
    //     break;
    // }

    res.status(200).json({ received: true });
  }
);

export default router;
```

메인 앱에서는 `app.use(stripeWebhookRouter)`로 붙이시면 됩니다. 서명 검증이랑 이벤트별 처리는 TODO로 비워뒀어요 — 어떤 이벤트부터 다룰지 정해지면 이어서 채워드릴게요.
