// ticketPermissions.js

import { PermissionFlagsBits } from 'discord.js';
import { getGuildConfig } from '../../services/config/guildConfig.js';
import { getTicketData } from '../database.js';

export async function getTicketPermissionContext({ client, interaction }) {
  const guildId = interaction.guildId;
  const channelId = interaction.channelId;

  const [config, ticketData] = await Promise.all([
    getGuildConfig(client, guildId),
    getTicketData(guildId, channelId)
  ]);

  const hasManageChannels = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
 // 1. Récupère la liste de tous vos rôles staff (ceux configurés dans le setup)
const staffRoles = config.staffRoles || []; 
// 2. Vérifie si le modérateur possède au moins un de ces rôles
const hasTicketStaffRole = staffRoles.some(roleId => interaction.member.roles?.cache?.has(roleId));
  const isTicketCreator = Boolean(
    ticketData?.userId && String(ticketData.userId) === String(interaction.user.id),
  );

  return {
    config,
    ticketData,
    hasManageChannels,
    hasTicketStaffRole,
    isTicketCreator,
    canManageTicket: hasManageChannels || hasTicketStaffRole,
    canCloseTicket: hasManageChannels || hasTicketStaffRole || isTicketCreator,
  };
}
