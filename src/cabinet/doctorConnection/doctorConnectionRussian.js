const db = require('../../config/db');

// Обработчик для связи с врачом (русский)
module.exports = async function handleDoctorConnectionRussian(bot, chatId) {
    // Запрашиваем информацию о пользователе
    const userResult = await db.query('SELECT doctor_key, key_valid FROM users WHERE chat_id = $1', [chatId]);
    const user = userResult.rows[0];

    // Если ключ валиден, нет необходимости снова вводить ключ
    if (user && user.key_valid) {
        const doctorResult = await db.query('SELECT * FROM doctors WHERE doctor_key = $1', [user.doctor_key]);

        if (doctorResult.rows.length > 0) {
            // Если ключ врача найден, предоставляем доступ к взаимодействию с врачом
            await bot.sendMessage(chatId, "Вы уже подключены к своему врачу.", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Назад в профиль', callback_data: 'back_to_profile' }],
                        [{ text: 'История сообщений', callback_data: 'view_messages' }],
                        [{ text: 'Написать сообщение', callback_data: 'send_message' }],
                        [{ text: 'Сменить врача', callback_data: 'change_doctor' }]  // Добавлена кнопка "Сменить врача"
                    ],
                },
            });
            return; // Выходим, так как нет необходимости снова вводить ключ
        }
    }

    // Если ключ недействителен или его нет, запрашиваем его у пользователя
    await bot.sendMessage(chatId, "Введите ключ от врача:");

    // Добавляем одноразовый обработчик для ввода ключа врача
    const handleKeyInput = async (msg) => {
        const doctorKey = msg.text;
        const result = await db.query('SELECT * FROM doctors WHERE doctor_key = $1', [doctorKey]);

        if (result.rows.length > 0) {
            // Если ключ правильный, обновляем doctor_key и key_valid
            await db.query('UPDATE users SET doctor_key = $1, key_valid = TRUE WHERE chat_id = $2', [doctorKey, chatId]);
            await bot.sendMessage(chatId, "Вы подключились к своему врачу.", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Назад в профиль', callback_data: 'back_to_profile' }],
                        [{ text: 'История сообщений', callback_data: 'view_messages' }],
                        [{ text: 'Написать сообщение', callback_data: 'send_message' }],
                        [{ text: 'Сменить врача', callback_data: 'change_doctor' }]  // Добавлена кнопка "Сменить врача"
                    ],
                },
            });
        } else {
            await bot.sendMessage(chatId, "Неверный ключ. Попробуйте снова.", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Назад', callback_data: 'back_to_profile' }],
                    ],
                },
            });
        }
    };

    // Устанавливаем одноразовый слушатель для текстовых сообщений
    bot.once('text', handleKeyInput);
};
