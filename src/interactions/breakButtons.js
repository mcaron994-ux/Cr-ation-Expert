import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';

// ⚙️ CONFIGURATION DES IDS (Mets tes vrais IDs chiffrés ici)
const LOG_CHANNEL_ID = 'METS_ID_DU_SALON_LOGS_ICI';    
const ROLE_MODO_ID = 'METS_ID_DU_ROLE_MODO_ICI';       
const ROLE_PAUSE_ID = 'METS_ID_DU_ROLE_PAUSE_ICI';     

export default {
    async handleButton(interaction) {
        const member = interaction.member || await interaction.guild.members.fetch(interaction.user.id);
        const guild = interaction.guild;
        const logChannel = guild?.channels.cache.get(LOG_CHANNEL_ID);

        // 🟢 CLIC : PRENDRE UNE PAUSE (Sur le serveur)
        if (interaction.customId === 'demarrer_pause') {
            if (!member.roles.cache.has(ROLE_MODO_ID)) {
                return interaction.reply({ content: '❌ Vous devez être un modérateur actif pour vous mettre en pause.', ephemeral: true });
            }

            try {
                await member.roles.remove(ROLE_MODO_ID);
                await member.roles.add(ROLE_PAUSE_ID);

                const embedLog = new EmbedBuilder()
                    .setTitle('☕ Pause Commencée')
                    .setDescription(`**${interaction.user.tag}** vient de partir en pause.`)
                    .setColor('#F1C40F')
                    .setTimestamp();
                if (logChannel) await logChannel.send({ embeds: [embedLog] });

                const boutonFin = new ButtonBuilder()
                    .setCustomId(`fin_pause_${member.id}`)
                    .setLabel('🔴 Arrêter ma pause')
                    .setStyle(ButtonStyle.Danger);

                const rowMP = new ActionRowBuilder().addComponents(boutonFin);

                const embedMP = new EmbedBuilder()
                    .setTitle('☕ Mode Pause Activé')
                    .setDescription('Vos accès ont été retirés.\n\n**Cliquez sur le bouton ci-dessous quand vous voulez reprendre votre poste.**')
                    .setColor('#F1C40F');

                await interaction.user.send({ embeds: [embedMP], components: [rowMP] });
                await interaction.reply({ content: '✅ Pause activée ! Vérifie tes **messages privés (MP)**.', ephemeral: true });

            } catch (error) {
                console.error(error);
                return interaction.reply({ content: '❌ Impossible de lancer la pause. Vérifie que tes MP sont bien **ouverts** !', ephemeral: true });
            }
        }

        // 🔴 CLIC : ARRÊTER LA PAUSE (Depuis les MP)
        if (interaction.customId.startsWith('fin_pause_')) {
            const userId = interaction.customId.replace('fin_pause_', '');
            
            try {
                // Note : Pour les MP, il faut cibler le bon serveur de modération si ton bot est sur plusieurs serveurs
                const targetGuild = interaction.client.guilds.cache.first(); 
                const targetMember = await targetGuild.members.fetch(userId);
                const targetLogChannel = targetGuild.channels.cache.get(LOG_CHANNEL_ID);

                if (!targetMember.roles.cache.has(ROLE_PAUSE_ID)) {
                    return interaction.reply({ content: '❌ Vous n\'êtes pas détecté en pause.', ephemeral: true });
                }

                await targetMember.roles.remove(ROLE_PAUSE_ID);
                await targetMember.roles.add(ROLE_MODO_ID);

                const embedFinLog = new EmbedBuilder()
                    .setTitle('⚔️ Retour de Pause')
                    .setDescription(`**${targetMember.user.tag}** est de retour et reprend son poste.`)
                    .setColor('#2ECC71')
                    .setTimestamp();
                if (targetLogChannel) await targetLogChannel.send({ embeds: [embedFinLog] });

                await interaction.update({
                    content: '✅ Votre pause est terminée ! Vos accès ont été restaurés.',
                    embeds: [],
                    components: []
                });

            } catch (error) {
                console.error(error);
                return interaction.reply({ content: '❌ Erreur lors du retour de pause. Contacte un administrateur.', ephemeral: true });
            }
        }
    }
};
