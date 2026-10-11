import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const reviews = sqliteTable('reviews', {id:text('id').primaryKey(),userId:text('user_id').notNull().unique(),name:text('name').notNull(),body:text('body').notNull(),rating:integer('rating').notNull(),createdAt:integer('created_at').notNull(),status:text('status').notNull().default('published'),orderId:text('order_id')});
// Accounts belonging to this website; existing reviews stay intact.
export const user=sqliteTable('auth_user',{
 id:text('id').primaryKey(),name:text('name').notNull(),email:text('email').notNull().unique(),emailVerified:integer('email_verified',{mode:'boolean'}).notNull().default(false),image:text('image'),createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull(),updatedAt:integer('updated_at',{mode:'timestamp_ms'}).notNull(),phoneNumber:text('phone_number').unique(),phoneNumberVerified:integer('phone_number_verified',{mode:'boolean'}),
});
export const session=sqliteTable('auth_session',{
 id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),token:text('token').notNull().unique(),expiresAt:integer('expires_at',{mode:'timestamp_ms'}).notNull(),createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull(),updatedAt:integer('updated_at',{mode:'timestamp_ms'}).notNull(),ipAddress:text('ip_address'),userAgent:text('user_agent'),
});
export const account=sqliteTable('auth_account',{
 id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),accountId:text('account_id').notNull(),providerId:text('provider_id').notNull(),accessToken:text('access_token'),refreshToken:text('refresh_token'),idToken:text('id_token'),accessTokenExpiresAt:integer('access_token_expires_at',{mode:'timestamp_ms'}),refreshTokenExpiresAt:integer('refresh_token_expires_at',{mode:'timestamp_ms'}),scope:text('scope'),password:text('password'),createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull(),updatedAt:integer('updated_at',{mode:'timestamp_ms'}).notNull(),
});
export const verification=sqliteTable('auth_verification',{
 id:text('id').primaryKey(),identifier:text('identifier').notNull(),value:text('value').notNull(),expiresAt:integer('expires_at',{mode:'timestamp_ms'}).notNull(),createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull(),updatedAt:integer('updated_at',{mode:'timestamp_ms'}).notNull(),
});
export const rateLimit=sqliteTable('auth_rate_limit',{id:text('id').primaryKey(),key:text('key').notNull().unique(),count:integer('count').notNull(),lastRequest:integer('last_request').notNull()});
