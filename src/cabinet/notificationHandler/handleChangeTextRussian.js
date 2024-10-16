const db = require('../../config/db'); // Импортируем базу данных

// Функция для обработки изменения текста уведомления
module.exports = async function handleChangeTextRussian(bot, chatId) {
    // Сообщение с просьбой ввести текст уведомления
    await bot.sendMessage(chatId, "Напишите сообщение, которое я буду отправлять вам каждый день в выбранное вами время.");

    // Обработчик текстового сообщения от пользователя
    bot.once('message', async (msg) => {
        const notificationText = msg.text; // Получаем текст от пользователя

        // Сохраняем текст в базе данных
        await db.query('UPDATE users SET notification_text = $1 WHERE chat_id = $2', [notificationText, chatId]);

        // Подтверждаем пользователю
        await bot.sendMessage(chatId, `Отлично, теперь я буду вам присылать вместо стандартного уведомления вот это: "${notificationText}".`);

        // Кнопка для возврата в профиль
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Вернуться в профиль', callback_data: 'back_to_profile' }],
                ],
            },
        };
        await bot.sendMessage(chatId, 'Чтобы вернуться в профиль, нажмите на кнопку ниже:', options);
    });
};
