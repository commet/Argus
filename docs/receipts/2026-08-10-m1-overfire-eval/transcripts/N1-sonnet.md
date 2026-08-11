Stripe 건은 다시 안 건드릴게.

argus_capture(provenance="user_stated", anchor_quote="어제 팀에서 결제 모듈은 Stripe로 가기로 확정했어", premise="결제 모듈 PG사: Stripe로 확정")

Express 웹훅 핸들러 스텁 만들었어.

`routes/webhooks/stripe.js`
```javascript
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// 이 라우트는 반드시 raw body로 받아야 서명 검증이 통과함.
// app.js에서 express.json()보다 먼저 이렇게 마운트:
//   app.use('/webhooks/stripe', express.raw({ type: 'application/json' }), require('./routes/webhooks/stripe'));
router.post('/', (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('[stripe webhook] signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed':
      // TODO: 결제 세션 완료 처리
      break;
    case 'invoice.payment_succeeded':
      // TODO: 결제 성공 처리
      break;
    case 'invoice.payment_failed':
      // TODO: 결제 실패 처리
      break;
    case 'customer.subscription.deleted':
      // TODO: 구독 취소 처리
      break;
    default:
      console.log(`[stripe webhook] unhandled event type: ${event.type}`);
  }

  res.status(200).json({ received: true });
});

module.exports = router;
```

필요한 환경 변수는 `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` 두 개. 이벤트별 실제 처리 로직은 TODO로 비워뒀으니 필요한 이벤트부터 채우면 돼.
