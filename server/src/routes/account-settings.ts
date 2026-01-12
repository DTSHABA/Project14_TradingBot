import { Hono } from 'hono';
import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import { accountSettings } from '../schema/account_settings';
import { eq } from 'drizzle-orm';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseProjectId } from '../lib/env';

const accountSettingsRoutes = new Hono();

// Get user account settings
accountSettingsRoutes.get('/', async (c) => {
  try {
    const user = c.get('user');
    const db = await getDatabase(getDatabaseUrl());

    const [settings] = await db.select()
      .from(accountSettings)
      .where(eq(accountSettings.user_id, user.id))
      .limit(1);

    if (!settings) {
      // Return default settings if none exist
      return c.json({
        timezone: 'UTC',
        email_notifications: true,
        notification_preferences: {
          trade_executions: true,
          circuit_breaker: true,
          daily_summary: true,
        },
      });
    }

    return c.json(settings);
  } catch (error) {
    console.error('Error fetching account settings:', error);
    return c.json({ error: 'Failed to fetch account settings' }, 500);
  }
});

// Update settings
accountSettingsRoutes.put('/', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { timezone, email_notifications, notification_preferences } = body;

    const db = await getDatabase(getDatabaseUrl());

    // Check if settings exist
    const [existing] = await db.select()
      .from(accountSettings)
      .where(eq(accountSettings.user_id, user.id))
      .limit(1);

    const updateData: {
      timezone?: string;
      email_notifications?: boolean;
      notification_preferences?: {
        trade_executions: boolean;
        circuit_breaker: boolean;
        daily_summary: boolean;
      };
      updated_at: Date;
    } = {
      updated_at: new Date(),
    };

    if (timezone !== undefined) {
      updateData.timezone = timezone;
    }

    if (email_notifications !== undefined) {
      updateData.email_notifications = email_notifications;
    }

    if (notification_preferences !== undefined) {
      updateData.notification_preferences = notification_preferences;
    }

    if (existing) {
      // Update existing
      const [updated] = await db.update(accountSettings)
        .set(updateData)
        .where(eq(accountSettings.user_id, user.id))
        .returning();

      return c.json(updated);
    } else {
      // Create new
      const [created] = await db.insert(accountSettings)
        .values({
          user_id: user.id,
          timezone: timezone || 'UTC',
          email_notifications: email_notifications !== undefined ? email_notifications : true,
          notification_preferences: notification_preferences || {
            trade_executions: true,
            circuit_breaker: true,
            daily_summary: true,
          },
        })
        .returning();

      return c.json(created, 201);
    }
  } catch (error) {
    console.error('Error updating account settings:', error);
    return c.json({ error: 'Failed to update account settings' }, 500);
  }
});

// Change password
accountSettingsRoutes.put('/password', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { current_password, new_password } = body;

    if (!current_password || !new_password) {
      return c.json({ error: 'current_password and new_password are required' }, 400);
    }

    if (new_password.length < 6) {
      return c.json({ error: 'New password must be at least 6 characters' }, 400);
    }

    // Get Firebase Auth instance
    const firebaseProjectId = getFirebaseProjectId();
    if (!firebaseProjectId) {
      return c.json({ error: 'Firebase not configured' }, 500);
    }

    const auth = getAuth();

    // Verify current password by attempting to sign in
    // Note: Firebase Admin SDK doesn't have a direct way to verify password
    // This would typically require calling Firebase Auth REST API or using client SDK
    // For now, we'll update the password directly (in production, verify current password first)

    try {
      // Update password using Firebase Admin SDK
      await auth.updateUser(user.id, {
        password: new_password,
      });

      return c.json({ success: true });
    } catch (error) {
      console.error('Error updating password:', error);
      return c.json({ error: 'Failed to update password' }, 500);
    }
  } catch (error) {
    console.error('Error changing password:', error);
    return c.json({ error: 'Failed to change password' }, 500);
  }
});

export default accountSettingsRoutes;

