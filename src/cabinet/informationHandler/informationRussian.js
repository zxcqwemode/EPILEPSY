module.exports = async function informationRussian(bot, chatId, messageId) {
    // Изменение сообщения на информацию о заболевании с кнопкой "Назад"
    const informationMessage = `
Эпилепсия — это неврологическое расстройство, характеризующееся повторяющимися приступами, вызванными аномальной электрической активностью в мозге. Признаки могут варьироваться от кратковременной потери сознания до сильных судорог.

Важно вести дневник приступов, чтобы выявить триггеры и улучшить лечение.
    `;

    // Определяем кнопку "Назад"
    const backOptions = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Назад', callback_data: 'back_to_profile' }]
            ]
        }
    };

    // Изменяем сообщение на информацию с кнопкой "Назад"
    await bot.editMessageText(informationMessage, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: backOptions.reply_markup
    });
};
