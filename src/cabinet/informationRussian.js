const db = require('../config/db');

module.exports = async function informationRussian(bot, chatId) {
    // Информация о заболевании
    const diseaseInfoMessage = `
Эпилепсия — это неврологическое расстройство, характеризующееся повторяющимися приступами, вызванными аномальной электрической активностью в мозге. Признаки могут варьироваться от кратковременной потери сознания до сильных судорог.

Важно вести дневник приступов, чтобы выявить триггеры и улучшить лечение.
    `;

    // Определяем кнопку "Назад"
    const backOptions = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Назад', callback_data: 'back_to_profile' },
                ],
            ],
        },
    };

    // Отправляем сообщение с информацией о заболевании и кнопкой "Назад"
    await bot.sendMessage(chatId, diseaseInfoMessage, backOptions);
};
