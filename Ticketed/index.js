const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
require('dotenv').config();
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

const commands = [
    {
        name: 'ticket',
        description: 'Create a support ticket',
        options: [
            {
                name: 'priority',
                description: 'Set the priority of the ticket',
                type: 3,
                required: false,
                choices: [
                    { name: 'Low', value: 'low' },
                    { name: 'Medium', value: 'medium' },
                    { name: 'High', value: 'high' }
                ]
            },
            {
                name: 'category',
                description: 'Select the category of the issue',
                type: 3,
                required: false,
                choices: [
                    { name: 'Billing', value: 'billing' },
                    { name: 'Technical Support', value: 'technical' },
                    { name: 'General Inquiry', value: 'general' }
                ]
            }
        ]
    },
    {
        name: 'close',
        description: 'Close the current ticket'
    },
    {
        name: 'faq',
        description: 'Redirect to the FAQ channel'
    },
    {
        name: 'feedback',
        description: 'Provide feedback for a resolved ticket'
    },
    {
        name: 'searchticket',
        description: 'Search for a ticket by user or keyword',
        options: [
            {
                name: 'user',
                description: 'Search tickets by user',
                type: 6,
                required: false
            },
            {
                name: 'keyword',
                description: 'Search tickets by keyword',
                type: 3,
                required: false
            }
        ]
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

client.once('ready', () => {
    console.log('Bot is online!');
});

const ticketCount = {};
const ticketLogs = 'ticket_logs.json';

const saveTicketLog = (log) => {
    fs.appendFile(ticketLogs, JSON.stringify(log) + '\n', err => {
        if (err) console.error('Error logging ticket:', err);
    });
};

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'ticket') {
        const category = interaction.guild.channels.cache.find(c => c.name === "Tickets" && c.type === 4);
        if (!category) {
            await interaction.reply('Ticket category does not exist! Please create a category named "Tickets".');
            return;
        }

        const priority = options.getString('priority') || 'medium';
        const issueCategory = options.getString('category') || 'general';
        const userId = interaction.user.id;

        if (!ticketCount[userId]) {
            ticketCount[userId] = 1;
        } else {
            ticketCount[userId]++;
        }

        const adminRole = interaction.guild.roles.cache.find(role => role.name === "Admin");
        if (!adminRole) {
            await interaction.reply('The Admin role does not exist. Please create a role named "Admin".');
            return;
        }

        const supportStaffRole = interaction.guild.roles.cache.find(role => role.name === "Support Staff");
        if (!supportStaffRole) {
            await interaction.reply('The Support Staff role does not exist. Please create a role named "Support Staff".');
            return;
        }

        const supportStaff = supportStaffRole.members;
        const availableStaff = supportStaff.filter(member => member.presence?.status === "online");
        const assignedStaff = availableStaff.random() || supportStaff.random();

        const ticketChannel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}-${ticketCount[userId]}`,
            type: 0,
            parent: category.id,
            permissionOverwrites: [
                {
                    id: interaction.guild.roles.everyone.id,
                    deny: ['ViewChannel']
                },
                {
                    id: interaction.user.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                },
                {
                    id: client.user.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                },
                {
                    id: adminRole.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                },
                {
                    id: assignedStaff ? assignedStaff.id : interaction.guild.roles.everyone.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                }
            ]
        });

        const log = {
            ticketId: ticketCount[userId],
            userId: userId,
            username: interaction.user.username,
            priority: priority,
            category: issueCategory,
            assignedStaff: assignedStaff ? assignedStaff.user.tag : 'None',
            timestamp: new Date().toISOString()
        };
        saveTicketLog(log);

        await interaction.reply(`Ticket created. Channel: ${ticketChannel}. Priority: ${priority}, Category: ${issueCategory}`);
        if (assignedStaff) {
            ticketChannel.send(`Welcome ${interaction.user}, a staff member will be with you shortly. Please describe your issue.`);
        } else {
            ticketChannel.send(`Welcome ${interaction.user}. Currently, no support staff is available. Please describe your issue, and we will get back to you as soon as possible.`);
        }
    }

    if (commandName === 'close') {
        if (interaction.channel.parent?.name !== "Tickets") {
            await interaction.reply('This command can only be used in a ticket channel.');
            return;
        }

        await interaction.reply('Closing ticket...');
        setTimeout(() => interaction.channel.delete(), 5000);
    }

    if (commandName === 'faq') {
        const faqChannel = interaction.guild.channels.cache.find(channel => channel.name === "faq" && channel.type === 0);
        if (!faqChannel) {
            await interaction.reply('The FAQ channel does not exist. Please create a channel named "#faq".');
            return;
        }

        await interaction.reply(`Take a look at ${faqChannel} before asking any unnecessary questions.`);
    }

    if (commandName === 'feedback') {
        await interaction.reply('Thank you for your feedback! Your input helps us improve our support services.');
    }

    if (commandName === 'searchticket') {
        const user = options.getUser('user');
        const keyword = options.getString('keyword');

        let logs;
        try {
            logs = fs.readFileSync(ticketLogs, 'utf-8').split('\n').filter(Boolean).map(JSON.parse);
        } catch (err) {
            console.error('Error reading ticket logs:', err);
            await interaction.reply('An error occurred while searching for tickets.');
            return;
        }

        const results = logs.filter(log => {
            return (user && log.userId === user.id) || (keyword && JSON.stringify(log).includes(keyword));
        });

        if (results.length === 0) {
            await interaction.reply('No tickets found matching the search criteria.');
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('Ticket Search Results')
            .setDescription(results.map(log => `Ticket ID: ${log.ticketId}\nUser: ${log.username}\nPriority: ${log.priority}\nCategory: ${log.category}\nAssigned Staff: ${log.assignedStaff}\nTimestamp: ${log.timestamp}`).join('\n\n'));

        await interaction.reply({ embeds: [embed] });
    }
});

client.login(process.env.TOKEN);


