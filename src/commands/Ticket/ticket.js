import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder, ComponentType, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../services/config/guildConfig.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

import ticketConfig from './modules/ticket_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription("Manages the server's ticket.")
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription('Sets up the ticket creation panel in a specified channel.')
                .addChannelOption((option) =>
                    option
                        .setName('panel_channel')
                        .setDescription('The channel where the ticket panel will be sent.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName('panel_message')
                        .setDescription('The main message/description for the ticket panel.')
                        .setRequired(true),
                )
                .addRoleOption((option) =>
                    option
                        .setName('staff_role_1')
                        .setDescription('Le premier role du staff (Obligatoire).')
                        .setRequired(true),
                )
                .addRoleOption((option) =>
                    option
                        .setName('staff_role_2')
                        .setDescription('Le deuxieme role du staff (Optionnel).')
                        .setRequired(false),
                )
                .addRoleOption((option) =>
                    option
                        .setName('staff_role_3')
                        .setDescription('Le troisieme role du staff (Optionnel).')
                        .setRequired(false),
                )
                .addRoleOption((option) =>
                    option
                        .setName('staff_role_4')
                        .setDescription('Le quatrieme role du staff (Optionnel).')
                        .setRequired(false),
                )
                .addRoleOption((option) =>
                    option
                        .setName('staff_role_5')
                        .setDescription('Le cinquieme role du staff (Optionnel).')
                        .setRequired(false),
                )
                .addStringOption((option) =>
                    option
                        .setName('button_label')
                        .setDescription('The label for the ticket creation button (default: Create Ticket)')
                        .setRequired(false),
                )
                .addChannelOption((option) =>
                    option
                        .setName('category')
                        .setDescription('The category where new tickets will be created (optional).')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addChannelOption((option) =>
                    option
                        .setName('closed_category')
                        .setDescription('The category where closed tickets will be moved (optional).')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addIntegerOption((option) =>
                    option
                        .setName('max_tickets_per_user')
                        .setDescription('Maximum number of tickets a user can create (default: 3)')
                        .setMinValue(1)
                        .setMaxValue(10)
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('dm_on_close')
                        .setDescription('Send DM to user when their ticket is closed (default: true)')
                        .setRequired(false),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand.setName('dashboard').setDescription('Open the interactive ticket system dashboard'),
        ),
    category: 'ticket',

    execute: async (interaction, config, client) => {
        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                logger.warn('Ticket command permission denied', {
                    userId: interaction.user.id,
                    guildId: interaction.guildId,
                    commandName: 'ticket',
                });

                return await replyUserError(interaction, {
                    type: ErrorTypes.PERMISSION,
                    message: 'You need the `Manage Channels` permission for this action.',
                });
            }

            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'dashboard') {
                const guildId = interaction.guildId;
                const guildConfig = await getGuildConfig(client, guildId);
                const ticketSystems = guildConfig.ticketSystems || [];

                if (ticketSystems.length === 0) {
                    return await replyUserError(interaction, {
                        type: ErrorTypes.UNKNOWN,
                        message: 'No ticket systems configured yet. Use `/ticket setup` to create one.',
                    });
                }

                // S'il y a plusieurs systèmes, afficher le sélecteur
                if (ticketSystems.length > 1) {
                    const selector = new StringSelectMenuBuilder()
                        .setCustomId('ticket_system_select')
                        .setPlaceholder('Choose a ticket system to manage...');

                    ticketSystems.forEach((system) => {
                        selector.addOptions(
                            new StringSelectMenuOptionBuilder()
                                .setLabel(system.ticketButtonLabel || 'Ticket System')
                                .setDescription(`System ID: ${system.id.substring(0, 15)}...`)
                                .setValue(system.id)
                                .setEmoji('🎫')
                        );
                    });

                    const row = new ActionRowBuilder().addComponents(selector);

                    await InteractionHelper.safeEditReply(interaction, {
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('🎫 Ticket Systems')
                                .setDescription('You have multiple ticket systems. Select one to manage:')
                                .setColor(getColor('info'))
                                .setFooter({ text: 'Menu expires in 5 minutes' })
                                .setTimestamp()
                        ],
                        components: [row],
                    });

                    // Attendre la sélection
                    try {
                        const collected = await interaction.channel?.awaitMessageComponent({
                            componentType: ComponentType.StringSelect,
                            filter: i => i.user.id === interaction.user.id && i.customId === 'ticket_system_select',
                            time: 300_000, // 5 minutes
                        });

                        if (!collected) return;

                        await collected.deferUpdate();
                        const selectedSystemId = collected.values[0];
                        const selectedSystem = ticketSystems.find(s => s.id === selectedSystemId);

                        if (!selectedSystem) {
                            return await replyUserError(interaction, {
                                type: ErrorTypes.UNKNOWN,
                                message: 'The selected ticket system could not be found.',
                            });
                        }

                        // Charger le dashboard pour ce système
                        return await ticketConfig.execute(interaction, selectedSystem, client);
                    } catch (error) {
                        if (error.code !== 'InteractionCollectorError') {
                            throw error;
                        }
                        return await InteractionHelper.safeEditReply(interaction, {
                            content: '⏱️ Menu expired.',
                            embeds: [],
                            components: [],
                        }).catch(() => {});
                    }
                } else {
                    // Un seul système, charger directement
                    return await ticketConfig.execute(interaction, ticketSystems[0], client);
                }
            }

            if (subcommand === 'setup') {
                const existingConfig = (await getGuildConfig(client, interaction.guildId)) || {};

                const panelChannel = interaction.options.getChannel('panel_channel');
                const categoryChannel = interaction.options.getChannel('category');
                const closedCategoryChannel = interaction.options.getChannel('closed_category');

                // Collect up to 5 staff roles
                const staffRoles = [
                    interaction.options.getRole('staff_role_1'),
                    interaction.options.getRole('staff_role_2'),
                    interaction.options.getRole('staff_role_3'),
                    interaction.options.getRole('staff_role_4'),
                    interaction.options.getRole('staff_role_5'),
                ].filter((r) => r !== null && r !== undefined);

                const panelMessage = interaction.options.getString('panel_message') || 'Click the button below to create a support ticket.';
                const buttonLabel = interaction.options.getString('button_label') || 'Create Ticket';
                const maxTicketsPerUser = interaction.options.getInteger('max_tickets_per_user') || 3;
                const dmOnClose = interaction.options.getBoolean('dm_on_close') !== false;

                // Create unique system ID
                const systemId = `ticket_${Date.now()}`;

                const setupEmbed = createEmbed({
                    title: 'Support Tickets',
                    description: panelMessage,
                    color: getColor('info'),
                });

                // Button with system ID embedded in customId
                const ticketButton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`create_ticket:${systemId}`)
                        .setLabel(buttonLabel)
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📩'),
                );

                const sentPanel = await panelChannel.send({ embeds: [setupEmbed], components: [ticketButton] });

                if (client.db && interaction.guildId) {
                    // Initialize ticketSystems array if it doesn't exist
                    const ticketSystems = existingConfig.ticketSystems || [];

                    // Create new ticket system
                    const newTicketSystem = {
                        id: systemId,
                        ticketCategoryId: categoryChannel ? categoryChannel.id : null,
                        ticketClosedCategoryId: closedCategoryChannel ? closedCategoryChannel.id : null,
                        ticketStaffRoleIds: staffRoles.map((r) => r.id),
                        ticketPanelChannelId: panelChannel.id,
                        ticketPanelMessageId: sentPanel?.id || null,
                        ticketPanelMessage: panelMessage,
                        ticketButtonLabel: buttonLabel,
                        maxTicketsPerUser: maxTicketsPerUser,
                        dmOnClose: dmOnClose,
                        createdAt: new Date().toISOString(),
                    };

                    // Add to systems array
                    ticketSystems.push(newTicketSystem);

                    // Update config
                    existingConfig.ticketSystems = ticketSystems;

                    await setGuildConfig(client, interaction.guildId, existingConfig);

                    logger.info('Ticket system created', {
                        guildId: interaction.guildId,
                        systemId: systemId,
                        categoryId: categoryChannel?.id,
                        closedCategoryId: closedCategoryChannel?.id,
                        staffRoleIds: staffRoles.map((r) => r.id),
                        maxTickets: maxTicketsPerUser,
                        dmOnClose: dmOnClose,
                    });
                } else {
                    logger.error('Ticket setup: database unavailable, panel sent but configuration was NOT saved', {
                        guildId: interaction.guildId,
                    });
                }

                let successMessage = `✅ The ticket creation panel has been sent to ${panelChannel}.\n`;

                if (categoryChannel) {
                    successMessage += `📁 New tickets will be created in the **${categoryChannel.name}** category.\n`;
                } else {
                    successMessage += '📁 New tickets will be created in a new "Tickets" category.\n';
                }

                if (closedCategoryChannel) {
                    successMessage += `🗂️ Closed tickets will be moved to **${closedCategoryChannel.name}**.\n`;
                }

                if (staffRoles.length > 0) {
                    successMessage += `👮 Staff Roles: ${staffRoles.map((r) => `**${r.name}**`).join(', ')}\n`;
                } else {
                    successMessage += '👮 No staff roles were specified.\n';
                }

                successMessage += `\n**⚙️ Max Tickets Per User:** ${maxTicketsPerUser}\n**📧 DM on Close:** ${dmOnClose ? 'Enabled' : 'Disabled'}\n**System ID:** \`${systemId}\``;

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed('Ticket Panel Set Up', successMessage)],
                });

                logger.info('Ticket panel setup completed', {
                    userId: interaction.user.id,
                    userTag: interaction.user.tag,
                    guildId: interaction.guildId,
                    systemId: systemId,
                    panelChannelId: panelChannel.id,
                    categoryId: categoryChannel?.id,
                    closedCategoryId: closedCategoryChannel?.id,
                    staffRoleIds: staffRoles.map((r) => r.id),
                    maxTickets: maxTicketsPerUser,
                    dmOnClose: dmOnClose,
                    commandName: 'ticket_setup',
                });

                return;
            }
        } catch (error) {
            logger.error('Ticket setup error', {
                error: error?.message,
                stack: error?.stack,
                userId: interaction?.user?.id,
                guildId: interaction?.guildId,
                commandName: 'ticket_setup',
            });

            if (interaction.deferred || interaction.replied) {
                try {
                    await replyUserError(interaction, {
                        type: ErrorTypes.UNKNOWN,
                        message: "Could not send the ticket panel or save configuration. Check the bot's permissions (especially the ability to send messages in the target channel).",
                    });
                } catch (err) {
                    logger.error('Failed to send error reply', { error: err.message, guildId: interaction.guildId });
                }
            } else {
                await handleInteractionError(interaction, error, {
                    commandName: 'ticket_setup',
                    source: 'ticket_setup_command',
                });
            }
        }
    },
};
