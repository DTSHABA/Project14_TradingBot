import { MiddlewareHandler } from 'hono';
import { verifyFirebaseToken } from '../lib/firebase-auth';
import { getDatabase } from '../lib/db';
import { eq } from 'drizzle-orm';
import { User, users } from '../schema/users';
import { getFirebaseProjectId, getDatabaseUrl, getAllowAnonymousUsers } from '../lib/env';

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
  }
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const token = authHeader.split('Bearer ')[1];
    const firebaseProjectId = getFirebaseProjectId();
    const firebaseUser = await verifyFirebaseToken(token, firebaseProjectId);
    
    // Check if anonymous users are allowed
    const allowAnonymous = getAllowAnonymousUsers();
    const isAnonymousUser = !firebaseUser.email;
    
    if (!allowAnonymous && isAnonymousUser) {
      return c.json({ error: 'Anonymous users are not allowed. Please sign in.' }, 403);
    }
    
    const firebaseUserId = firebaseUser.id;
    const email = firebaseUser.email || null;

    const databaseUrl = getDatabaseUrl();
    const db = await getDatabase(databaseUrl);

    // Check if user with Firebase ID already exists
    const [existingUserById] = await db.select()
      .from(users)
      .where(eq(users.id, firebaseUserId))
      .limit(1);

    // Check if user with email exists (if email provided)
    let existingUserByEmail = null;
    if (email) {
      const [userByEmail] = await db.select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      existingUserByEmail = userByEmail;
    }

    // Firebase ID is the source of truth - always prioritize it
    if (existingUserById) {
      // User with Firebase ID exists - update email if it changed
      if (email && existingUserById.email !== email) {
        // If email changed and another user has that email, we need to handle it
        if (existingUserByEmail && existingUserByEmail.id !== firebaseUserId) {
          // Another user has this email - clear their email (they'll need to re-authenticate)
          await db.update(users)
            .set({
              email: null,
              updated_at: new Date(),
            })
            .where(eq(users.id, existingUserByEmail.id));
        }
        // Update Firebase user's email
        await db.update(users)
          .set({
            email: email,
            updated_at: new Date(),
          })
          .where(eq(users.id, firebaseUserId));
      }
    } else {
      // User with Firebase ID doesn't exist
      if (existingUserByEmail) {
        // Email exists but different ID - this is a conflict
        // We can't change the ID if it already exists, so we'll use the Firebase ID
        // and clear the old user's email (they'll need to re-authenticate)
        await db.update(users)
          .set({
            email: null,
            updated_at: new Date(),
          })
          .where(eq(users.id, existingUserByEmail.id));
      }
      
      // Insert new user with Firebase ID
      try {
        await db.insert(users)
          .values({
            id: firebaseUserId,
            email: email,
            display_name: null,
            photo_url: null,
          });
      } catch (error: any) {
        // If we still get an email conflict, clear email and retry
        if (error?.code === '23505' && error?.constraint_name === 'users_email_key' && email) {
          await db.insert(users)
            .values({
              id: firebaseUserId,
              email: null, // Insert without email to avoid conflict
              display_name: null,
              photo_url: null,
            });
          // Then update email if possible
          if (email) {
            try {
              await db.update(users)
                .set({
                  email: email,
                  updated_at: new Date(),
                })
                .where(eq(users.id, firebaseUserId));
            } catch {
              // If email update fails, user exists without email - that's okay
            }
          }
        } else {
          throw error;
        }
      }
    }

    // Get the user from database
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, firebaseUserId))
      .limit(1);

    if (!user) {
      console.error('User not found after insert attempt for ID:', firebaseUserId);
      return c.json({ error: 'User creation failed' }, 500);
    }

    c.set('user', user);
    await next();
  } catch (error) {
    console.error('Authentication error:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
}; 