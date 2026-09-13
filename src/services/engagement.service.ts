/**
 * Engagement & system services: achievements, certificates,
 * notifications, subscriptions, guardian summaries, assessment.
 */

import { clone, mockRequest } from "@/lib/api/client";
import { db } from "@/services/mock-db";
import type {
  Achievement,
  AppNotification,
  Certificate,
  GuardianSummary,
  SubscriptionPlan,
  SubscriptionTier,
} from "@/types/domain";

export const achievementService = {
  list(signal?: AbortSignal): Promise<Achievement[]> {
    return mockRequest(() => clone(db.achievements), signal);
  },
};

export const certificateService = {
  list(signal?: AbortSignal): Promise<Certificate[]> {
    return mockRequest(() => clone(db.certificates), signal);
  },
};

export const notificationService = {
  list(signal?: AbortSignal): Promise<AppNotification[]> {
    return mockRequest(() => clone(db.notifications), signal);
  },

  markRead(id: string, signal?: AbortSignal): Promise<AppNotification[]> {
    return mockRequest(() => {
      db.notifications = db.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      return clone(db.notifications);
    }, signal);
  },

  markAllRead(signal?: AbortSignal): Promise<AppNotification[]> {
    return mockRequest(() => {
      db.notifications = db.notifications.map((n) => ({ ...n, read: true }));
      return clone(db.notifications);
    }, signal);
  },
};

export const subscriptionService = {
  listPlans(signal?: AbortSignal): Promise<SubscriptionPlan[]> {
    return mockRequest(() => clone(db.plans), signal);
  },

  changeTier(tier: SubscriptionTier, signal?: AbortSignal): Promise<SubscriptionPlan[]> {
    return mockRequest(() => {
      db.plans = db.plans.map((p) => ({ ...p, current: p.tier === tier }));
      db.student = { ...db.student, subscriptionTier: tier };
      return clone(db.plans);
    }, signal);
  },
};

export const guardianService = {
  getSummary(signal?: AbortSignal): Promise<GuardianSummary> {
    return mockRequest(() => clone(db.guardian), signal);
  },
};
