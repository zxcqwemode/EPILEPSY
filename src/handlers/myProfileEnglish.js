const db = require('../config/db');

module.exports = async function callbackMyProfileEnglish(bot, msg) {
    const chatId = msg.chat.id;

    try {
        // Запрос к базе данных для получения информации о пользователе
        const user = await db.query('SELECT * FROM users WHERE chat_id = $1', [chatId]);

        if (user.rows.length === 0) {
            await bot.sendMessage(chatId, 'Error! Your profile was not found.');
            return;
        }

        const { chat_id, gender, timezone_gmt, notification_period, notification_hour_msk } = user.rows[0];

        // Формирование сообщения с данными профиля
        const profileMessage = `
Your profile:
- ID: ${chat_id}
- Gender: ${gender || 'Not specified'}
- Time zone (GMT): ${timezone_gmt}
- Notification period: ${notification_period || 'Not specified'}
- Notification hour (MSK): ${notification_hour_msk || 'Not specified'}
        `;

        // Отправка профиля пользователю
        await bot.sendMessage(chatId, profileMessage);
    } catch (err) {
        console.error('Error processing myProfileEnglish command:', err);
        await bot.sendMessage(chatId, 'An error occurred while retrieving your profile. Please try again later.');
    }
};
