결제 모듈 Stripe 건은 확정된 걸로 알고 넘어갈게요 — 다시 안 엽니다.

웹훅 핸들러 스텁 만들었습니다.

**`webhooks/stripeWebhookHandler.js`**
```js
const express = require('express');

const router = express.Router();

// Stripe 서명 검증에는 raw body가 필요합니다.
// 전역 express.json() 파서보다 이 라우트가 먼저 걸리도록 마운트하세요.
router.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const signature = req.headers['stripe-signature'];
    let event;

    try {
      // TODO: Stripe SDK 연결 후 실제 검증으로 교체
      // event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
      event = JSON.parse(req.body.toString());
    } catch (err) {
      console.error('[stripe webhook] signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      // TODO: 실제로 처리할 이벤트 타입 분기, 예:
      // case 'checkout.session.completed':
      // case 'payment_intent.succeeded':
      // case 'payment_intent.payment_failed':
      default:
        console.log(`[stripe webhook] unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  }
);

module.exports = router;
```

연결 예시 (`app.js` 등):
```js
const stripeWebhookRouter = require('./webhooks/stripeWebhookHandler');
app.use(stripeWebhookRouter);
```

남은 TODO:
- `npm install stripe`, `STRIPE_WEBHOOK_SECRET` 환경변수 설정
- 위 raw body 파싱 순서 지키기 (전역 JSON 파서보다 앞)
- 실제 이벤트 핸들링 로직 채우기
