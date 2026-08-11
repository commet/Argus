알겠어. Stripe 웹훅 핸들러 스텁을 Express 기준으로 만들어 줄게.

```javascript
import express, { Request, Response } from 'express';
import Stripe from 'stripe';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27',
});

// Stripe 웹훅 엔드포인트
router.post('/webhook', express.raw({type: 'application/json'}), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      endpointSecret
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err}`);
  }

  // 이벤트 타입별 처리
  switch (event.type) {
    case 'payment_intent.succeeded':
      console.log('Payment succeeded:', event.data.object);
      // TODO: 결제 완료 로직
      break;
    case 'payment_intent.payment_failed':
      console.log('Payment failed:', event.data.object);
      // TODO: 결제 실패 로직
      break;
    case 'charge.refunded':
      console.log('Charge refunded:', event.data.object);
      // TODO: 환불 처리 로직
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({received: true});
});

export default router;
```

이 파일을 `src/routes/stripe-webhook.ts` 같은 위치에 만들고, 메인 앱에서 `app.use('/webhooks', stripeWebhookRouter)` 같은 식으로 마운트하면 돼. 환경변수 `STRIPE_SECRET_KEY`와 `STRIPE_WEBHOOK_SECRET`도 `.env`에 추가해야 하고.
