const db = require('../config/db');
const callbackHandlerRussian = require('../handlers/callbackHandlerRussian');
const callbackHandlerEnglish = require('../handlers/callbackHandlerEnglish');
let languageChoice;
module.exports = async function handleLanguageSelection(bot, callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    try {
        if (data === 'language_russian') {
            // Обновляем язык в базе данных
            languageChoice = 'language_russian';
            await db.query('UPDATE users SET language = $1 WHERE chat_id = $2', ['Русский', chatId]);

            await bot.editMessageText(`Записал, ваш язык: Русский.`, {
                chat_id: chatId,
                message_id: messageId,
            });

            // Определяем кнопки для выбора роли
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Врач', callback_data: 'role_doctor' },
                            { text: 'Пациент', callback_data: 'role_patient' },
                        ],
                    ],
                },
            };

            // Отправляем сообщение с выбором роли
            await bot.sendMessage(chatId, 'Выберите свою роль:', options);

            // Вызываем обработчик для русского языка
            //await callbackHandlerRussian(bot, callbackQuery);

        } else if (data === 'language_english') {
            languageChoice = 'language_english';
            // Обновляем язык в базе данных
            await db.query('UPDATE users SET language = $1, step = $2 WHERE chat_id = $3', ['English', 'role_choice', chatId]);

            await bot.editMessageText(`Your language: English.`, {
                chat_id: chatId,
                message_id: messageId,
            });

            // Определяем кнопки для выбора роли
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Doctor', callback_data: 'role_doctor' },
                            { text: 'Patient', callback_data: 'role_patient' },
                        ],
                    ],
                },
            };

            // Отправляем сообщение с выбором роли
            await bot.sendMessage(chatId, 'Choose your role:', options);

            // Вызываем обработчик для английского языка
            //await callbackHandlerEnglish(bot, callbackQuery);
        }
    } catch (err) {
        console.error('Ошибка при обработке выбора языка:', err);
    }
};
