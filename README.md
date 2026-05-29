# Cloudy Message Relay & Discord Bot

A standalone Node.js & TypeScript microservice that acts as an Express HTTP API, a Discord bot client, and an SMTP email forwarder. It receives contact form submissions from the **Cloudy Artist Portfolio** website and relays them directly to:
1. **Discord**: Posts a styled, rich embed with the message details to a specific channel (with optional developer/artist pings).
2. **Email**: Forwards the submission as a clean, responsive HTML email to the artist's configured address.

---

## Architecture & Flow

The message relay service operates as a decoupled gateway. The diagram below illustrates how client submissions are handled and routed:

```mermaid
graph TD
    subgraph "Client Side"
        A["Cloudy Artist Portfolio<br/>(Contact Form Submissions)"]
    end

    subgraph "Message Relay Server (Port 5001)"
        B["Express API Router<br/>(POST /api/messages)"]
        C["Discord Bot Service<br/>(discord.js client)"]
        D["Email Forwarding Service<br/>(Nodemailer Transport)"]
    end

    subgraph "External Notification Targets"
        E["Discord Guild / DMs<br/>(ANSI-Colored Embeds)"]
        F["Artist Email Inbox<br/>(Responsive HTML Cards)"]
    end

    A -->|HTTP POST JSON| B
    B -->|Triggers| C
    B -->|Triggers| D
    C -->|Sends Embed| E
    D -->|Sends Mail| F
```

- **Service Boot**: During initialization, the Discord Bot connects to the gateway and the SMTP Mail Server connection is validated using Nodemailer.
- **Payload Validation**: The Express router ensures that the request body contains a name, message, and at least one contact channel (email or Discord ID).

---

## Tech Stack
- **Runtime**: Node.js (with ECMAScript Modules)
- **Language**: TypeScript
- **HTTP Server**: Express
- **Discord Bot client**: `discord.js`
- **Email Forwarder**: `nodemailer`
- **Development runner**: `tsx`

---

## Project Structure

```
src/
├── app.ts                 # Express application definition, global middleware, & route mounting
├── server.ts              # Service bootstrap entry point, global error handling, & graceful shutdown
├── config.ts              # Type-safe environment variables validation & logging
├── routes.ts              # API route definitions and controller bindings
├── controllers/
│   └── messageController.ts # POST /api/messages handler: coordinates service dispatching & responses
├── services/
│   ├── discordService.ts  # Singleton managing Discord client bot connection & embeds
│   └── emailService.ts    # Singleton managing SMTP transporter pools & HTML template rendering
├── middleware/
│   ├── errorHandler.ts    # Centralized global Express error interceptor returning unified JSON response
│   └── rateLimiter.ts     # In-memory IP-based rate limiting to protect endpoints from spam
├── errors/
│   └── AppError.ts        # Custom operational error classes (ValidationError, ConfigurationError, RelayError)
├── utils/
│   └── logger.ts          # Structured level-based console logging utility with timestamps & colors
└── types/
    └── index.ts           # Shared TypeScript type definitions
```

---

## Setup & Configuration

### 1. Install Dependencies
Navigate into this directory and run:
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and fill out the fields:

#### Discord Bot Setup
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Create a **New Application** and click the **Bot** tab.
3. Click **Reset Token** and copy the bot token into `DISCORD_BOT_TOKEN`.
4. Turn on the **Guild Members Intent** and **Message Content Intent** under the Bot's Privileged Gateway Intents section.
5. Invite the bot to your Discord Server using the OAuth2 URL Generator (select `bot` scope and permissions: `Send Messages`, `Embed Links`).
6. Right-click the channel in Discord where you want messages posted and select **Copy Channel ID**. Paste it into `DISCORD_NOTIFICATION_CHANNEL_ID`.
7. (Optional) Right-click your own profile in Discord and click **Copy User ID**. Paste it into `DISCORD_ARTIST_USER_ID` to receive pings.

#### Email SMTP Setup
Configure your SMTP settings under the `SMTP_*` variables:
- **Gmail**: If using Gmail, set `SMTP_HOST=smtp.gmail.com` and `SMTP_PORT=587`. You **must** generate and use an **App Password** (not your regular account password). Under your Google Account > Security > 2-Step Verification > App passwords, create one for "Other (Custom name)".
- Set `ARTIST_EMAIL` to the target address where you want to receive the messages.

---

## Running the Server

### Development Mode (with hot-reloading)
```bash
npm run dev
```

### Production Build & Start
```bash
npm run build
```
```bash
npm start
```

Once running, the server will expose:
- `POST /api/messages` - Main contact submission relay endpoint.
- `GET /api/health` - Basic health check confirming loaded integrations.

---

## Connecting with the Portfolio
The portfolio is configured to send requests to `http://localhost:5001/api/messages` by default.

To customize this:
- **Locally**: The local fallback is ready. No changes are required.
- **Production**: Configure the `actionUrl` field in the database (under `contactContent.form.actionUrl` in your CMS configuration) to point to your deployed Message Relay server endpoint (e.g., `https://your-relay-service.com/api/messages`).
