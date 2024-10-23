// Похожая структура, только с текстом на английском
module.exports = async function handleNotificationsEnglish(bot, chatId) {
    const message = "Here you can change the text and time of the messages.";

    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Back', callback_data: 'back_to_profile' },
                    { text: 'Change notification', callback_data: 'change_notification' },
                ],
            ],
        },
    };

    await bot.sendMessage(chatId, message, options);
};
