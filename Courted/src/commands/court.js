const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('court')
    .setDescription('Take someone to court')
    .addUserOption(option => option.setName('user').setDescription('The user to take to court').setRequired(true)),
  async execute(interaction) {
    const user = interaction.options.getUser('user');

    const courtCategory = interaction.guild.channels.cache.find(c => c.name === 'Court Cases' && c.type === 4);
    if (!courtCategory) {
      await interaction.reply('The "Court Cases" category does not exist. Please create it.');
      return;
    }

    const courtChannel = await interaction.guild.channels.create({
      name: `court-case-${interaction.user.username}-vs-${user.username}`,
      type: 0,
      parent: courtCategory.id
    });

    const thread = await courtChannel.threads.create({
      name: `${interaction.user.username}-vs-${user.username}`,
      autoArchiveDuration: 1440,
      reason: 'Court case thread'
    });

    await thread.send(`${interaction.user} is taking ${user} to court.`);

    await interaction.reply(`You have taken ${user} to court. A court case has been created.`);
  },
};
