알겠어, Stripe 건은 다시 안 건드릴게. 웹훅 스텁부터.

이 프로젝트는 Next.js라 API 라우트로 만드는 방법도 있는데, Express 기준으로 요청해서 독립 라우터 모듈로 뺐어. 실제로 어느 서버/디렉토리에 붙일지 알려주면 거기 맞춰서 옮길게.

```javascript
// routes/stripe-webhook.js
//
// Stripe 웹훅 핸들러 스텁
// 필요 env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// 필요 패키지: npm install stripe
//
// 주의: 서명 검증에 raw body가 필요해서, 이 라우트는 express.json() 같은
// body parser를 거치기 전에(혹은 안 거치고) 마운트해야 함.

const express = require('express');
const Stripe = require('stripe');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

router.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const signature = req.headers['stripe-signature'];

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (err) {
      console.error('[stripe-webhook] signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // TODO: 이벤트별 처리 로직 미구현 (스텁)
    switch (event.type) {
      case 'checkout.session.completed':
        // TODO: 결제 완료 처리
        break;
      case 'payment_intent.succeeded':
        // TODO: 결제 성공 처리
        break;
      case 'payment_intent.payment_failed':
        // TODO: 결제 실패 처리
        break;
      case 'invoice.payment_failed':
        // TODO: 구독 결제 실패 처리
        break;
      default:
        console.log(`[stripe-webhook] unhandled event type: ${event.type}`);
    }

    // Stripe는 2xx를 못 받으면 재시도하니, 처리 로직 붙이기 전에도 200은 먼저 내려줘야 함
    res.status(200).json({ received: true });
  }
);

module.exports = router;
```

마운트:
```javascript
// app.js
const stripeWebhookRouter = require('./routes/stripe-webhook');
app.use('/', stripeWebhookRouter);
```

이벤트별 실제 처리(DB 반영, 멱등성 등)는 비워뒀어 — 나중에 결제 상태를 이 프로젝트 DB에 쓰게 되면 `db.ts` 경유 규칙이 있으니 그때 참고해. TS나 ESM 버전 필요하면 바로 바꿔줄게.
