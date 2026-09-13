import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('breakpanel')
        .setDescription('Affiche le panel de pause pour les modérateurs')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Réservé aux admins pour l'installer

    async execute(interaction) {
        const embedPanel = new EmbedBuilder()
            .setTitle('☕ Espace Pause du Staff')
            .setDescription('Cliquez sur le bouton ci-dessous pour vous mettre en pause et suspendre temporairement vos rôles de modération.')
            .setColor('#3498DB');

        const boutonPause = new ButtonBuilder()
            .setCustomId('demarrer_pause')
            .setLabel('☕ Prendre une pause')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(boutonPause);

        await interaction.reply({ content: '✅ Panel envoyé !', ephemeral: true });
        await interaction.channel.send({ embeds: [embedPanel], components: [row] });
    }
};
