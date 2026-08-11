네, Stripe 확정 건 다시 안 건드리겠습니다. 바로 웹훅 핸들러 스텁 갑니다.

```ts
// webhooks/stripeWebhookHandler.ts
// Stub route for Stripe webhook events.
// IMPORTANT: mount this BEFORE any express.json()/body-parser on this path —
// Stripe signature verification needs the raw request body, not parsed JSON.

import express, { type Request, type Response, type Router } from "express";

const router: Router = express.Router();

router.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"];

    // TODO: verify signature once STRIPE_WEBHOOK_SECRET is wired up
    // let event;
    // try {
    //   event = stripe.webhooks.constructEvent(
    //     req.body,
    //     signature,
    //     process.env.STRIPE_WEBHOOK_SECRET!
    //   );
    // } catch (err) {
    //   return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    // }

    // TODO: handle event types
    // switch (event.type) {
    //   case "checkout.session.completed":
    //     break;
    //   case "payment_intent.succeeded":
    //     break;
    //   case "payment_intent.payment_failed":
    //     break;
    // }

    res.status(200).json({ received: true });
  }
);

export default router;
```

마운트할 때는 다른 body-parser보다 먼저 걸어야 합니다:

```ts
import stripeWebhookRouter from "./webhooks/stripeWebhookHandler";
app.use(stripeWebhookRouter); // express.json() 등 전역 파서보다 앞에
```

참고로 이 레포 메인 앱은 Next.js App Router라 API 라우트가 보통
`src/app/api/.../route.ts` 형태인데, 별도 Express 서버 쪽에 두시는 거면 경로는
그쪽 구조에 맞춰 옮기시면 됩니다. JS 프로젝트면 타입 애너테이션만 지우면 그대로
씁니다. 서명 검증이랑 이벤트 분기는 스텁이라 TODO로 비워놨고, 시크릿 붙는
시점에 채우면 됩니다.
