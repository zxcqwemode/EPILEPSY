const db = require('../../config/db');

// Обработчик для просмотра сообщений (русский)
module.exports = async function handleViewMessagesRussian(bot, chatId) {
    const messages = await db.query('SELECT * FROM messages WHERE user_id = $1 ORDER BY message_date ASC', [chatId]);

    if (messages.rows.length > 0) {
        let messageText = "История переписки:\n";
        messages.rows.forEach((msg) => {
            messageText += `(${msg.message_date}) ${msg.message_text}\n`;
        });

        await bot.sendMessage(chatId, messageText);
    } else {
        await bot.sendMessage(chatId, "У вас нет сообщений.");
    }
};
