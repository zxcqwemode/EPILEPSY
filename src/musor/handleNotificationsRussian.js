const db = require('../config/db');

// Функция для обработки уведомлений
module.exports = async function handleNotificationsRussian(bot, chatId) {
    const message = "Здесь вы можете изменить текст и время сообщений.";

    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Назад', callback_data: 'back_to_profile' },
                    { text: 'Изменить уведомление', callback_data: 'change_notification' },
                ],
            ],
        },
    };

    await bot.sendMessage(chatId, message, options);
};
