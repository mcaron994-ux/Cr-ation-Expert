import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { infoEmbed, successEmbed } from '../../utils/embeds.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { verifyUser } from '../../services/verificationService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify yourself and gain access to the server'),

    async execute(interaction, config, client) {
        try {
            // Ensure we have time to respond
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            }

            const guild = interaction.guild;
            logger.info('Verify command started', {
                userId: interaction.user.id,
                guildId: guild.id,
                username: interaction.user.username
            });

            const result = await verifyUser(client, guild.id, interaction.user.id, {
                source: 'command_self',
                moderatorId: null
            });

            logger.info('Verification result:', { status: result.status, userId: interaction.user.id });

            if (result.status === 'already_verified') {
                return await InteractionHelper.safeReply(interaction, {
                    embeds: [infoEmbed('Already Verified', "You are already verified.")],
                    flags: MessageFlags.Ephemeral
                });
            }

            await InteractionHelper.safeReply(interaction, {
                embeds: [successEmbed(
                    "Verification Complete",
                    `You have been verified and given the **${result.roleName}** role! Welcome to the server! 🎉`
                )],
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            logger.error('Error in verify command:', {
                userId: interaction.user.id,
                guildId: interaction.guild.id,
                error: error.message,
                errorCode: error.context?.errorCode
            });

            // Send error to user
            const userMessage = error.userMessage || 'Verification failed. Please try again in a moment.';
            await replyUserError(interaction, error, userMessage);
        }
    }
};

