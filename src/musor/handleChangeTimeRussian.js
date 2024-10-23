// Функция для изменения времени уведомления через кабинет
module.exports = async function handleChangeTimeRussian(bot, chatId) {
    const message = "Когда вам удобно получать уведомления?";

    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Утром', callback_data: 'time_morning_edit' },
                    { text: 'Днем', callback_data: 'time_afternoon_edit' },
                    { text: 'Вечером', callback_data: 'time_evening_edit' },
                ],
            ],
        },
    };

    await bot.sendMessage(chatId, message, options);
};
