const db = require('../../config/db');

// Обработчик для связи с врачом (русский)
module.exports = async function handleDoctorConnectionRussian(bot, chatId) {
    await bot.sendMessage(chatId, "Введите ключ от врача:");

    // Добавляем обработчик для ввода ключа врача
    const handleKeyInput = async (msg) => {
        const doctorKey = msg.text;
        const result = await db.query('SELECT * FROM doctors WHERE doctor_key = $1', [doctorKey]);

        if (result.rows.length > 0) {
            await db.query('UPDATE users SET doctor_key = $1 WHERE chat_id = $2', [doctorKey, chatId]); // Сохраняем ключ
            await bot.sendMessage(chatId, "Вы подключились к своему лечащему врачу.", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Назад в профиль', callback_data: 'back_to_profile' }],
                        [{ text: 'История переписки', callback_data: 'view_messages' }],
                        [{ text: 'Написать сообщение', callback_data: 'send_message' }],
                    ],
                },
            });
        } else {
            await bot.sendMessage(chatId, "Неверный ключ. Попробуйте еще раз.", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Назад', callback_data: 'back_to_profile' }],
                    ],
                },
            });
        }
    };

    // Устанавливаем слушатель для текстовых сообщений
    bot.on('text', handleKeyInput);

    // Добавляем обработчик для нажатия на кнопку "Назад"
    bot.on('callback_query', (callbackQuery) => {
        if (callbackQuery.data === 'back_to_profile') {
            // Если пользователь нажимает "Назад", убираем слушатель для ввода ключа
            bot.off('text', handleKeyInput); // Убираем слушатель для ввода ключа
            bot.sendMessage(chatId, "Вы вернулись в профиль.");
        }
    });
};
