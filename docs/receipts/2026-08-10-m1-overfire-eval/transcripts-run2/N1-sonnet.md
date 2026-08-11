알겠어, Stripe 건은 다시 안 꺼낼게.

argus_capture({ premise: "결제 모듈 PG사는 Stripe로 확정", source: "user_stated", anchor_quote: "어제 팀에서 결제 모듈은 Stripe로 가기로 확정했어" })

Express 기준 웹훅 핸들러 스텁이야:

```ts
// stripeWebhookHandler.ts — Stripe 웹훅 핸들러 스텁 (Express)
// 실제 프로젝트 구조에 맞는 경로로 옮겨서 쓰면 돼. `stripe` 패키지 설치 필요 (npm install stripe).

import express, { Request, Response, Router } from "express";
import Stripe from "stripe";

const router: Router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

// 서명 검증에는 raw body가 필요 — 이 라우트 앞에 express.json()이 걸리면 안 됨
router.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).send("Missing Stripe-Signature header");
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      console.error(`[stripe-webhook] signature verification failed: ${message}`);
      return res.status(400).send(`Webhook Error: ${message}`);
    }

    switch (event.type) {
      case "checkout.session.completed":
        // TODO: 결제 완료 처리
        break;
      case "payment_intent.succeeded":
        // TODO: 결제 성공 처리
        break;
      case "payment_intent.payment_failed":
        // TODO: 결제 실패 처리
        break;
      default:
        console.log(`[stripe-webhook] unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  }
);

export default router;
```

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` 환경변수만 채우면 바로 마운트해서 쓸 수 있어.
