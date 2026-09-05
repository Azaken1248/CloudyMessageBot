import path from 'path';
import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { escapeHtml, isLikelyEmail, mailtoHref } from '../utils/sanitize.js';
import type { RelayMessage } from '../types/index.js';

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private initializing = false;

  public async initialize(): Promise<void> {
    if (!config.smtp.user || !config.smtp.pass) {
      logger.warn('EMAIL', 'SMTP username or App Password missing. Email forwarding will be disabled.');
      return;
    }

    if (this.transporter || this.initializing) {
      return;
    }

    this.initializing = true;
    logger.info('EMAIL', 'Initializing SMTP Nodemailer transporter pool...');

    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });

    try {
      await this.transporter.verify();
      logger.info('EMAIL', `SMTP connection pool verified and established successfully to ${config.smtp.host}:${config.smtp.port}`);
    } catch (error) {
      logger.error('EMAIL', 'SMTP connection pool validation failed:', error);
      this.transporter = null;
    } finally {
      this.initializing = false;
    }
  }

  public isEnabled(): boolean {
    return !!config.smtp.user && !!config.smtp.pass && this.transporter !== null;
  }

  public async sendRelay(data: RelayMessage): Promise<boolean> {
    if (!this.transporter) {
      logger.warn('EMAIL', 'Discarding dispatch: SMTP transporter is not initialized.');
      return false;
    }

    if (!config.artistEmail) {
      logger.warn('EMAIL', 'Discarding dispatch: Destination ARTIST_EMAIL is not configured.');
      return false;
    }

    logger.info('EMAIL', `Routing message from "${data.name}" to Email inbox...`);
    logger.debug('EMAIL', `SMTP settings: host=${config.smtp.host}, port=${config.smtp.port}, sender=${config.smtp.from}, recipient=${config.artistEmail}`);

    try {
      // Escaped copies for interpolation; the raw values are never placed in markup.
      const safe = {
        name: escapeHtml(data.name),
        email: escapeHtml(data.email),
        discordId: escapeHtml(data.discordId),
        preferredContact: escapeHtml(data.preferredContact),
        subject: escapeHtml(data.subject),
        message: escapeHtml(data.message),
      };
      // Only a well-formed address becomes a clickable link or a Reply-To.
      const emailIsLinkable = isLikelyEmail(data.email);
      const emailLink = emailIsLinkable ? mailtoHref(data.email) : '';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
            <style>
              body {
                font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #4A4A68;
                background-color: #F0F4FC;
                padding: 30px 15px;
                margin: 0;
              }
              .container {
                max-width: 580px;
                margin: 0 auto;
                background: #FFFFFF;
                border-radius: 28px;
                overflow: hidden;
                box-shadow: 0 16px 40px rgba(175, 195, 235, 0.25);
                border: 1px solid rgba(175, 195, 235, 0.2);
              }
              .header {
                background: linear-gradient(135deg, #AFC3FF 0%, #D8B4FE 100%);
                color: #1A1A3A;
                padding: 40px 24px;
                text-align: center;
                position: relative;
              }
              .header-badge {
                display: inline-block;
                background-color: rgba(255, 255, 255, 0.4);
                padding: 6px 14px;
                border-radius: 30px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.15em;
                color: #4F46E5;
                margin-top: 10px;
              }
              .header h1 {
                margin: 8px 0 0 0;
                font-size: 26px;
                font-weight: 700;
                letter-spacing: -0.01em;
              }
              .content {
                padding: 35px 30px;
              }
              .meta-card {
                background-color: #F5F7FF;
                border: 1px solid rgba(175, 195, 235, 0.15);
                border-radius: 20px;
                padding: 20px;
                margin-bottom: 25px;
              }
              .meta-row {
                margin-bottom: 12px;
              }
              .meta-row:last-child {
                margin-bottom: 0;
              }
              .label {
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: #94A3B8;
                font-weight: 600;
                margin-bottom: 3px;
              }
              .value {
                font-size: 15px;
                color: #334155;
                font-weight: 500;
              }
              .value a {
                color: #6366F1;
                text-decoration: none;
              }
              .value a:hover {
                text-decoration: underline;
              }
              .message-label {
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: #94A3B8;
                font-weight: 600;
                margin-bottom: 8px;
                padding-left: 5px;
              }
              .message-card {
                white-space: pre-wrap;
                background-color: #FAF5FF;
                border: 1px dashed #D8B4FE;
                padding: 24px;
                border-radius: 24px;
                font-size: 15px;
                line-height: 1.6;
                color: #4A4A68;
                position: relative;
              }
              .footer {
                background-color: #F8FAFC;
                padding: 24px;
                text-align: center;
                border-top: 1px solid #F1F5F9;
                font-size: 12px;
                color: #94A3B8;
              }
              .footer p {
                margin: 4px 0;
              }
              .footer a {
                color: #6366F1;
                text-decoration: none;
              }
              .footer a:hover {
                text-decoration: underline;
              }
              .bow-icon {
                width: 54px;
                height: auto;
                margin-bottom: 4px;
              }
              .candy-icon {
                width: 32px;
                height: auto;
                margin-bottom: 8px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <img class="bow-icon" src="cid:icon_bow" alt="🎀" />
                <h1>New Message!</h1>
                <div class="header-badge">Portfolio Contact Form</div>
              </div>
              
              <div class="content">
                <div class="meta-card">
                  <div class="meta-row">
                    <div class="label">From Client</div>
                    <div class="value"><strong>${safe.name}</strong></div>
                  </div>
                  <div class="meta-row">
                    <div class="label">Email Address</div>
                    <div class="value">${safe.email ? (emailIsLinkable ? `<a href="${emailLink}">${safe.email}</a>` : safe.email) : '<em>Not provided</em>'}</div>
                  </div>
                  <div class="meta-row">
                    <div class="label">Discord ID</div>
                    <div class="value">${safe.discordId ? `<strong>${safe.discordId}</strong>` : '<em>Not provided</em>'}</div>
                  </div>
                  <div class="meta-row">
                    <div class="label">Preferred Contact Method</div>
                    <div class="value" style="display: inline-block; background-color: #E0E7FF; color: #4F46E5; padding: 4px 10px; border-radius: 12px; font-size: 13px; font-weight: 600; margin-top: 4px;">${safe.preferredContact}</div>
                  </div>
                  <div class="meta-row" style="margin-top: 12px; border-top: 1px solid rgba(175, 195, 235, 0.15); padding-top: 12px;">
                    <div class="label">Subject</div>
                    <div class="value" style="font-weight: 600; color: #1E1B4B;">${safe.subject || 'No Subject Specified'}</div>
                  </div>
                </div>
                
                <div class="message-label">Inquiry Message</div>
                <div class="message-card">${safe.message}</div>
              </div>
              
              <div class="footer">
                <img class="candy-icon" src="cid:asset_candyjar" alt="🍬" /><br>
                <p>Sent via <strong>Cloudy Message Relay Service</strong>.</p>
                ${emailIsLinkable ? `<p>To reply to this message, you can reply directly to this email: <a href="${emailLink}">${safe.email}</a>.</p>` : ''}
                ${safe.discordId ? `<p>Alternatively, reach out on Discord at: <strong>${safe.discordId}</strong>.</p>` : ''}
              </div>
            </div>
          </body>
        </html>
      `;

      const info = await this.transporter.sendMail({
        from: config.smtp.from,
        to: config.artistEmail,
        subject: `🎀 [New Portfolio Message] ${data.subject || 'Inquiry'} from ${data.name}`,
        ...(emailIsLinkable ? { replyTo: data.email } : {}),
        html: htmlContent,
        attachments: [
          {
            filename: 'icon_bow.png',
            path: path.join(process.cwd(), 'assets/icon_bow.png'),
            cid: 'icon_bow',
          },
          {
            filename: 'asset_candyjar.png',
            path: path.join(process.cwd(), 'assets/asset_candyjar.png'),
            cid: 'asset_candyjar',
          },
        ],
      });

      logger.info('EMAIL', `Email notification delivered successfully to artist. Message ID: ${info.messageId}`);
      logger.debug('EMAIL', `SMTP Server Response: ${info.response}`);
      return true;
    } catch (error) {
      logger.error('EMAIL', 'Failed to dispatch email notification via SMTP:', error);
      return false;
    }
  }

  public shutdown(): void {
    if (this.transporter) {
      logger.info('EMAIL', 'Closing SMTP connection transporter pool...');
      this.transporter.close();
      this.transporter = null;
      logger.info('EMAIL', 'SMTP transporter pool closed.');
    }
  }
}

export const emailService = new EmailService();
