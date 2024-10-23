const db = require('../config/db');

// Обработчик для связи с врачом (английский)
module.exports = async function handleDoctorConnectionEnglish(bot, chatId) {
    await bot.sendMessage(chatId, "Please enter your doctor's key:");

    // Добавляем обработчик для ввода ключа врача
    const handleKeyInput = async (msg) => {
        const doctorKey = msg.text;
        const result = await db.query('SELECT * FROM doctors WHERE doctor_key = $1', [doctorKey]);

        if (result.rows.length > 0) {
            await db.query('UPDATE users SET doctor_key = $1 WHERE chat_id = $2', [doctorKey, chatId]); // Сохраняем ключ
            await bot.sendMessage(chatId, "You are now connected to your doctor.", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Back to profile', callback_data: 'back_to_profile' }],
                        [{ text: 'Message history', callback_data: 'view_messages' }],
                        [{ text: 'Send message', callback_data: 'send_message' }],
                    ],
                },
            });
        } else {
            await bot.sendMessage(chatId, "Invalid key. Please try again.", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Back', callback_data: 'back_to_profile' }],
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
            bot.sendMessage(chatId, "You have returned to your profile.");
        }
    });
};
