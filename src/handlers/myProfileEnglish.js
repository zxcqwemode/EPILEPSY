const db = require('../config/db');
const informationEnglish = require('../cabinet/informationEnglish'); // Импортируем обработчик информации о заболевании на английском

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
Welcome to your personal account!
Your Profile:
- ID: ${chat_id}
- Gender: ${gender || 'Not specified'}
- Timezone (GMT): ${timezone_gmt}
- Notification period: ${notification_period || 'Not specified'}
- Notification hour (Moscow): ${notification_hour_msk || 'Not specified'}
        `;

        // Определяем кнопки для личного кабинета
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Information about the disease', callback_data: 'info_about_disease' },
                        { text: 'Notifications', callback_data: 'notifications' },
                    ],
                    [
                        { text: 'Seizure Calendar', callback_data: 'seizure_calendar' },
                        { text: 'Contact Doctor', callback_data: 'contact_doctor' },
                    ],
                    [
                        { text: 'Make a Record', callback_data: 'make_record' },
                        { text: 'Seizure', callback_data: 'seizure' },
                    ],
                ],
            },
        };

        // Отправка профиля пользователю
        await bot.sendMessage(chatId, profileMessage);
        // Отправка кнопок для управления личным кабинетом
        await bot.sendMessage(chatId, 'Choose an action:', options);
    } catch (err) {
        console.error('Error while processing the myProfileEnglish command:', err);
        await bot.sendMessage(chatId, 'An error occurred while retrieving your profile. Please try again later.');
    }
};
