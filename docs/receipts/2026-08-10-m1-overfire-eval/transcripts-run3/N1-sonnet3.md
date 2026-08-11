어제 결정한 건 다시 안 건드릴게요 — 바로 웹훅 핸들러 스텁 만들었습니다.

레포에서 정확히 어디 두는 구조인지 몰라서 일단 아래 경로로 잡았어요. 위치는 맞게 옮겨주세요.

`server/webhooks/stripeWebhookHandler.ts`

```typescript
import express, { Router, type Request, type Response } from 'express';

const router = Router();

/**
 * Stripe 웹훅 핸들러 스텁.
 * 서명 검증 · 이벤트 라우팅은 아직 미구현 — 이 상태로는 배포하지 않는다.
 *
 * mount 예시: app.use('/webhooks/stripe', router)
 */
router.post(
  '/',
  express.raw({ type: 'application/json' }), // Stripe 서명 검증은 raw body가 필요 (express.json()보다 먼저 마운트)
  async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).send('Missing Stripe-Signature header');
    }

    // TODO: stripe SDK + STRIPE_WEBHOOK_SECRET 연결되면 아래로 교체
    //
    // let event: Stripe.Event;
    // try {
    //   event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
    // } catch (err) {
    //   console.error('[stripe webhook] signature verification failed:', err);
    //   return res.status(400).send('Webhook signature verification failed');
    // }
    //
    // switch (event.type) {
    //   case 'payment_intent.succeeded':
    //     // TODO
    //     break;
    //   case 'checkout.session.completed':
    //     // TODO
    //     break;
    //   default:
    //     console.log(`[stripe webhook] unhandled event type: ${event.type}`);
    // }

    console.warn('[stripe webhook] stub handler — signature verification not implemented yet');
    return res.status(501).json({ received: false, reason: 'not_implemented' });
  }
);

export default router;
```

`stripe` 패키지는 아직 안 깔려있을 수 있어서 실제 검증 로직은 주석으로만 남겨뒀고, 지금은 서명 헤더 존재 여부만 확인하고 501을 돌려줘요. 이벤트 타입별 처리 채우는 건 다음에 이어서 할까요?
