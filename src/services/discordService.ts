import { Client, GatewayIntentBits, EmbedBuilder, TextChannel, AttachmentBuilder } from 'discord.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { RelayMessage } from '../types/index.js';

class DiscordService {
  private client: Client | null = null;
  private ready = false;
  private initializing = false;

  public async initialize(): Promise<void> {
    if (!config.discord.token) {
      logger.warn('DISCORD', 'Bot token is missing. Discord notifications will be disabled.');
      return;
    }

    if (this.client || this.initializing) {
      return;
    }

    this.initializing = true;
    logger.info('DISCORD', 'Initializing Discord bot client...');

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
      ],
    });

    this.client.once('ready', (c) => {
      this.ready = true;
      this.initializing = false;
      logger.info('DISCORD', `Discord bot client ready and logged in as ${c.user.tag}`);
    });

    this.client.on('error', (error) => {
      logger.error('DISCORD', 'Discord client encountered a runtime error:', error);
    });

    try {
      await this.client.login(config.discord.token);
    } catch (error) {
      logger.error('DISCORD', 'Failed to authenticate Discord bot token:', error);
      this.client = null;
      this.ready = false;
      this.initializing = false;
    }
  }

  public isEnabled(): boolean {
    return !!config.discord.token && this.client !== null;
  }

  public isClientReady(): boolean {
    return this.ready && this.client !== null;
  }

  public async sendRelay(data: RelayMessage): Promise<boolean> {
    if (!this.client || !this.ready) {
      logger.warn('DISCORD', 'Discarding dispatch: Discord bot is not initialized or authenticated.');
      return false;
    }

    const hasChannel = !!config.discord.channelId;
    const hasArtistId = !!config.discord.artistUserId;

    if (!hasChannel && !hasArtistId) {
      logger.warn('DISCORD', 'Discarding dispatch: Neither Discord Channel ID nor Artist User ID is configured.');
      return false;
    }

    logger.info('DISCORD', `Routing message from "${data.name}" to Discord...`);

    const bowAttachment = new AttachmentBuilder(
      '/home/azaken/Desktop/ProjectCloudy/Cloudy Web Icons/PNG/Web Icon/icon_bow.png',
      { name: 'icon_bow.png' }
    );

    const metadataBlock = [
      '```ansi',
      `\u001b[1;36m👤 Sender:    \u001b[0;37m${data.name}`,
      `\u001b[1;36m📧 Email:     \u001b[0;32m${data.email || 'Not provided'}`,
      `\u001b[1;36m👾 Discord:   \u001b[0;32m${data.discordId || 'Not provided'}`,
      `\u001b[1;36m✨ Preferred: \u001b[1;35m${data.preferredContact}`,
      `\u001b[1;36m📝 Subject:   \u001b[0;37m${data.subject || 'No Subject Specified'}`,
      '```'
    ].join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xD8B4FE)
      .setTitle('🎀 New Message Received!')
      .setThumbnail('attachment://icon_bow.png')
      .setDescription(`### 📋 Metadata\n${metadataBlock}\n### 💬 Message\n>>> ${data.message}`)
      .setTimestamp()
      .setFooter({ text: 'Cloudy Portfolio Contact Relay', iconURL: 'attachment://icon_bow.png' });

    let sentToDM = false;
    let sentToChannel = false;

    if (hasArtistId) {
      try {
        const user = await this.client.users.fetch(config.discord.artistUserId);
        if (user) {
          await user.send({
            content: '🔔 New message received from your portfolio contact form!',
            embeds: [embed],
            files: [bowAttachment],
          });
          logger.info('DISCORD', `Direct Message successfully delivered to user ID: ${config.discord.artistUserId}`);
          sentToDM = true;
        }
      } catch (error) {
        logger.error('DISCORD', `Failed to send Direct Message to user ${config.discord.artistUserId}:`, error);
      }
    }

    if (hasChannel) {
      try {
        const channel = await this.client.channels.fetch(config.discord.channelId);
        if (channel && channel instanceof TextChannel) {
          const mentionStr = config.discord.artistUserId ? `<@${config.discord.artistUserId}>` : '';
          await channel.send({
            content: `🔔 ${mentionStr} You received a new portfolio message!`,
            embeds: [embed],
            files: [bowAttachment],
          });
          logger.info('DISCORD', `Notification post successfully sent to channel: ${config.discord.channelId}`);
          sentToChannel = true;
        } else {
          logger.error('DISCORD', `Channel with ID ${config.discord.channelId} is invalid or is not a text channel.`);
        }
      } catch (error) {
        logger.error('DISCORD', `Failed to publish to channel ${config.discord.channelId}:`, error);
      }
    }

    return sentToDM || sentToChannel;
  }

  public async shutdown(): Promise<void> {
    if (this.client) {
      logger.info('DISCORD', 'Disconnecting Discord bot client connection pool...');
      await this.client.destroy();
      this.client = null;
      this.ready = false;
      logger.info('DISCORD', 'Discord client disconnected cleanly.');
    }
  }
}

export const discordService = new DiscordService();
