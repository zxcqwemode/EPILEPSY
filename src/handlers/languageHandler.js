const db = require('../config/db'); // Убедитесь, что db импортируется первым

// Хранилище для отслеживания состояний кнопок для каждого пользователя
const userContinueButtonStatus = {}; // Объект для хранения состояния кнопки "Continue" для каждого chatId

module.exports = async function handleLanguageSelection(bot, callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    try {
        if (data === 'language_russian') {
            // Обновляем язык в базе данных
            await db.query('UPDATE users SET language = $1, step = $2 WHERE chat_id = $3', ['Русский', 'role_choice', chatId]);

            await bot.editMessageText('Записал, ваш язык: Русский.', {
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

        } else if (data === 'language_english') {
            // Обновляем язык в базе данных
            await db.query('UPDATE users SET language = $1, step = $2 WHERE chat_id = $3', ['English', 'role_choice', chatId]);

            await bot.editMessageText('Your language: English.', {
                chat_id: chatId,
                message_id: messageId,
            });

            // Отправляем приветственное сообщение на английском
            await bot.sendMessage(chatId, `Hello, I am EpilepsyBot!\n` +
                `I help track when, how, and why you have seizures.\n` +
                `\n` +
                `Doctors recommend keeping such a diary every day. Thanks to my data, the doctor will quickly determine the real cause of the seizures and find treatment that works.\n` +
                `\n` +
                `Choose a language so I can tell you more.\n` +
                `\n` +
                `If you have already interacted with my previous version — don't worry, I have saved all your data.`);

            // Определяем кнопку "Continue"
            const continueOptions = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Continue', callback_data: 'continue_to_role_choice' }
                        ],
                    ],
                },
            };

            // Отправляем кнопку "Continue"
            await bot.sendMessage(chatId, 'Click to continue:', continueOptions);

            // Устанавливаем статус кнопки "Continue" в активное состояние
            userContinueButtonStatus[chatId] = true;

            // Добавляем обработчик для кнопки "Continue"
            bot.on('callback_query', async (continueCallback) => {
                const continueData = continueCallback.data;

                if (continueData === 'continue_to_role_choice') {
                    // Проверяем, была ли кнопка уже нажата
                    if (userContinueButtonStatus[chatId]) {
                        // Делаем кнопку неактивной после первого нажатия
                        userContinueButtonStatus[chatId] = false;

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
                    } else {
                        // Если кнопка уже была нажата, ничего не делаем
                        await bot.answerCallbackQuery(continueCallback.id, { text: "You've already pressed continue.", show_alert: false });
                    }
                }
            });
        }
    } catch (err) {
        console.error('Ошибка при обработке выбора языка:', err);
    }
};
