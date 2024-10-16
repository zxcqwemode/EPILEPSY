// Функция для изменения уведомлений
module.exports = async function handleChangeNotificationRussian(bot, chatId) {
    const message = "Выберите, что именно вы желаете изменить:";

    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Текст', callback_data: 'change_text' },
                    { text: 'Время', callback_data: 'change_time' },
                ],
                [
                    { text: 'Назад в профиль', callback_data: 'back_to_profile' }, // Изменено текст кнопки и callback_data
                ],
            ],
        },
    };

    await bot.sendMessage(chatId, message, options);
};
