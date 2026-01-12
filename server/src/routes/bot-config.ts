import { Hono } from 'hono';
import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import { botConfigs } from '../schema/bot_configs';
import { eq, and } from 'drizzle-orm';

const botConfigRoutes = new Hono();

// Create bot configuration
botConfigRoutes.post('/', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const {
      mt5_account_id,
      risk_percent,
      stop_loss_range,
      risk_reward_ratio,
      trading_sessions,
    } = body;

    // Validate required fields
    if (!mt5_account_id) {
      return c.json({ error: 'mt5_account_id is required' }, 400);
    }

    // Validate risk_percent (0.1% - 2.0%)
    const riskPercent = risk_percent ? parseFloat(risk_percent) : 0.5;
    if (riskPercent < 0.1 || riskPercent > 2.0) {
      return c.json({ error: 'risk_percent must be between 0.1 and 2.0' }, 400);
    }

    // Validate stop_loss_range
    const stopLossRange = stop_loss_range || { min: 0.25, max: 0.40, preferred: 0.30 };
    if (stopLossRange.min >= stopLossRange.max) {
      return c.json({ error: 'stop_loss_range.min must be less than max' }, 400);
    }

    // Validate risk_reward_ratio (>= 1.0)
    const rrRatio = risk_reward_ratio ? parseFloat(risk_reward_ratio) : 1.2;
    if (rrRatio < 1.0) {
      return c.json({ error: 'risk_reward_ratio must be >= 1.0' }, 400);
    }

    // Validate trading_sessions (at least one required)
    const sessions = trading_sessions || [];
    if (!Array.isArray(sessions) || sessions.length === 0) {
      return c.json({ error: 'At least one trading session is required' }, 400);
    }

    const db = await getDatabase(getDatabaseUrl());

    // Check if config already exists for this account
    const [existing] = await db.select()
      .from(botConfigs)
      .where(and(
        eq(botConfigs.mt5_account_id, mt5_account_id),
        eq(botConfigs.user_id, user.id)
      ))
      .limit(1);

    if (existing) {
      return c.json({ error: 'Bot configuration already exists for this account. Use PUT to update.' }, 400);
    }

    // Create new config
    const [newConfig] = await db.insert(botConfigs)
      .values({
        user_id: user.id,
        mt5_account_id,
        risk_percent: riskPercent.toString(),
        stop_loss_range: stopLossRange,
        risk_reward_ratio: rrRatio.toString(),
        trading_sessions: sessions,
        is_trading_active: false,
      })
      .returning();

    return c.json(newConfig, 201);
  } catch (error) {
    console.error('Error creating bot config:', error);
    return c.json({ error: 'Failed to create bot configuration' }, 500);
  }
});

// Get configuration for account
botConfigRoutes.get('/:mt5_account_id', async (c) => {
  try {
    const user = c.get('user');
    const mt5AccountId = c.req.param('mt5_account_id');
    const db = await getDatabase(getDatabaseUrl());

    const [config] = await db.select()
      .from(botConfigs)
      .where(and(
        eq(botConfigs.mt5_account_id, mt5AccountId),
        eq(botConfigs.user_id, user.id)
      ))
      .limit(1);

    if (!config) {
      return c.json({ error: 'Bot configuration not found' }, 404);
    }

    return c.json(config);
  } catch (error) {
    console.error('Error fetching bot config:', error);
    return c.json({ error: 'Failed to fetch bot configuration' }, 500);
  }
});

// Update configuration
botConfigRoutes.put('/:id', async (c) => {
  try {
    const user = c.get('user');
    const configId = c.req.param('id');
    const body = await c.req.json();
    const {
      risk_percent,
      stop_loss_range,
      risk_reward_ratio,
      trading_sessions,
    } = body;

    const db = await getDatabase(getDatabaseUrl());

    // Verify config belongs to user
    const [existing] = await db.select()
      .from(botConfigs)
      .where(and(
        eq(botConfigs.id, configId),
        eq(botConfigs.user_id, user.id)
      ))
      .limit(1);

    if (!existing) {
      return c.json({ error: 'Bot configuration not found' }, 404);
    }

    // Build update object
    const updateData: {
      risk_percent?: string;
      stop_loss_range?: { min: number; max: number; preferred: number };
      risk_reward_ratio?: string;
      trading_sessions?: Array<{ start: string; end: string; type: string }>;
      updated_at: Date;
    } = {
      updated_at: new Date(),
    };

    if (risk_percent !== undefined) {
      const riskPercent = parseFloat(risk_percent);
      if (riskPercent < 0.1 || riskPercent > 2.0) {
        return c.json({ error: 'risk_percent must be between 0.1 and 2.0' }, 400);
      }
      updateData.risk_percent = riskPercent.toString();
    }

    if (stop_loss_range !== undefined) {
      if (stop_loss_range.min >= stop_loss_range.max) {
        return c.json({ error: 'stop_loss_range.min must be less than max' }, 400);
      }
      updateData.stop_loss_range = stop_loss_range;
    }

    if (risk_reward_ratio !== undefined) {
      const rrRatio = parseFloat(risk_reward_ratio);
      if (rrRatio < 1.0) {
        return c.json({ error: 'risk_reward_ratio must be >= 1.0' }, 400);
      }
      updateData.risk_reward_ratio = rrRatio.toString();
    }

    if (trading_sessions !== undefined) {
      if (!Array.isArray(trading_sessions) || trading_sessions.length === 0) {
        return c.json({ error: 'At least one trading session is required' }, 400);
      }
      updateData.trading_sessions = trading_sessions;
    }

    const [updatedConfig] = await db.update(botConfigs)
      .set(updateData)
      .where(eq(botConfigs.id, configId))
      .returning();

    return c.json(updatedConfig);
  } catch (error) {
    console.error('Error updating bot config:', error);
    return c.json({ error: 'Failed to update bot configuration' }, 500);
  }
});

// Toggle trading (pause/resume)
botConfigRoutes.post('/:id/toggle-trading', async (c) => {
  try {
    const user = c.get('user');
    const configId = c.req.param('id');
    const db = await getDatabase(getDatabaseUrl());

    // Verify config belongs to user
    const [config] = await db.select()
      .from(botConfigs)
      .where(and(
        eq(botConfigs.id, configId),
        eq(botConfigs.user_id, user.id)
      ))
      .limit(1);

    if (!config) {
      return c.json({ error: 'Bot configuration not found' }, 404);
    }

    // Toggle is_trading_active
    const [updatedConfig] = await db.update(botConfigs)
      .set({
        is_trading_active: !config.is_trading_active,
        updated_at: new Date(),
      })
      .where(eq(botConfigs.id, configId))
      .returning();

    return c.json({ is_trading_active: updatedConfig.is_trading_active });
  } catch (error) {
    console.error('Error toggling trading:', error);
    return c.json({ error: 'Failed to toggle trading' }, 500);
  }
});

export default botConfigRoutes;

