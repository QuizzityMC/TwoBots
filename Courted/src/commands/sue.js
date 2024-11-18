const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sue')
        .setDescription('Sue someone')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user you want to sue')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for suing')
                .setRequired(true)),
    async execute(interaction) {
        try {
            const target = interaction.options.getUser('target');
            const reason = interaction.options.getString('reason');

            await interaction.reply(`${interaction.user.username} is suing ${target.username} for ${reason}.`);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    },
};
