// Похожая структура, только с текстом на английском
module.exports = async function handleChangeNotificationEnglish(bot, chatId) {
    const message = "Choose what you want to change:";

    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Text', callback_data: 'change_text' },
                    { text: 'Time', callback_data: 'change_time' },
                ],
                [
                    { text: 'Back to profile', callback_data: 'back_to_profile' },
                ],
            ],
        },
    };

    await bot.sendMessage(chatId, message, options);
};
