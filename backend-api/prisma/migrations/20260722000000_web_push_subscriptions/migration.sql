-- Switch push subscriptions from Firebase FCM tokens to Web Push (VAPID) subscriptions.
-- fcmToken (a single opaque token) is replaced by the three fields a
-- PushSubscription.toJSON() produces: endpoint, keys.p256dh, keys.auth.
ALTER TABLE "g4d_push_subscriptions" RENAME COLUMN "fcmToken" TO "endpoint";
ALTER TABLE "g4d_push_subscriptions" ADD COLUMN "p256dh" TEXT NOT NULL DEFAULT '';
ALTER TABLE "g4d_push_subscriptions" ADD COLUMN "auth" TEXT NOT NULL DEFAULT '';
ALTER TABLE "g4d_push_subscriptions" ALTER COLUMN "p256dh" DROP DEFAULT;
ALTER TABLE "g4d_push_subscriptions" ALTER COLUMN "auth" DROP DEFAULT;
