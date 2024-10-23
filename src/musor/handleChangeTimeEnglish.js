const db = require('../config/db');

module.exports = async function handleChangeTimeEnglish(bot, chatId) {
    const message = "When do you prefer to receive notifications?";

    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Morning', callback_data: 'time_morning_edit' },
                    { text: 'Afternoon', callback_data: 'time_afternoon_edit' },
                    { text: 'Evening', callback_data: 'time_evening_edit' },
                ],
            ],
        },
    };

    await bot.sendMessage(chatId, message, options);
};
