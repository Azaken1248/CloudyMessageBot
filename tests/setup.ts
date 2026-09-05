// Blank every outbound credential before config.ts is imported. dotenv only
// fills variables that are absent, so setting them here keeps the suite from
// picking up the developer's real .env — and guarantees no test can reach a
// real Discord channel or SMTP server.
process.env.NODE_ENV = 'test'
process.env.DISCORD_BOT_TOKEN = ''
process.env.DISCORD_NOTIFICATION_CHANNEL_ID = ''
process.env.DISCORD_ARTIST_USER_ID = ''
process.env.SMTP_USER = ''
process.env.SMTP_PASS = ''
process.env.ARTIST_EMAIL = ''
process.env.CLIENT_URL = 'http://localhost:5173'
process.env.TRUSTED_PROXIES = 'loopback'
process.env.CLIENT_IP_SOURCE = 'auto'
