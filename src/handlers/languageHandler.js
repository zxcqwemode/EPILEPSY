const db = require('../config/db');

// Storage for tracking button states for each user
const userContinueButtonStatus = {};

module.exports = async function handleLanguageSelection(bot, callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    try {
        // Проверяем существование пользователя
        const userExists = await db.query('SELECT * FROM users WHERE chat_id = $1', [chatId]);

        if (userExists.rows.length === 0) {
            console.log('User not found in database');
            return;
        }

        if (data === 'language_russian') {
            await db.query('UPDATE users SET language = $1, step = $2 WHERE chat_id = $3',
                ['Русский', 'role_choice', chatId]);

            await bot.editMessageText('Записал, ваш язык: Русский.', {
                chat_id: chatId,
                message_id: messageId,
            });

            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {text: 'Врач', callback_data: 'role_doctor'},
                            {text: 'Пациент', callback_data: 'role_patient'},
                        ],
                    ],
                },
            };

            await bot.sendMessage(chatId, 'Выберите свою роль:', options);

        } else if (data === 'language_english') {
            await db.query('UPDATE users SET language = $1, step = $2 WHERE chat_id = $3',
                ['English', 'role_choice', chatId]);

            await bot.editMessageText('Your language: English.', {
                chat_id: chatId,
                message_id: messageId,
            });

            await bot.sendMessage(chatId, `Hello, I am EpilepsyBot!\n` +
                `I help track when, how, and why you have seizures.\n` +
                `\n` +
                `Doctors recommend keeping such a diary every day. Thanks to my data, the doctor will quickly determine the real cause of the seizures and find treatment that works.\n` +
                `\n` +
                `Choose a language so I can tell you more.\n` +
                `\n` +
                `If you have already interacted with my previous version — don't worry, I have saved all your data.`);

            const continueOptions = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {text: 'Continue', callback_data: 'continue_to_role_choice'}
                        ],
                    ],
                },
            };

            await bot.sendMessage(chatId, 'Click to continue:', continueOptions);
            userContinueButtonStatus[chatId] = true;
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
                                        {text: 'Doctor', callback_data: 'role_doctor'},
                                        {text: 'Patient', callback_data: 'role_patient'},
                                    ],
                                ],
                            },
                        };

                        // Отправляем сообщение с выбором роли
                        await bot.sendMessage(chatId, 'Choose your role:', options);

                        // Удаляем сообщение с кнопкой "Continue"
                        await bot.editMessageText('Click to continue:', {
                            chat_id: chatId,
                            message_id: continueCallback.message.message_id,
                            reply_markup: {
                                inline_keyboard: [], // Пустая клавиатура
                            },
                        });
                    } else {
                        // Если кнопка уже была нажата, ничего не делаем
                        await bot.answerCallbackQuery(continueCallback.id, {
                            text: "You've already pressed continue.",
                            show_alert: false
                        });
                    }
                }
            });
        }
    } catch (err) {
        console.error('Ошибка при обработке выбора языка:', err);
    }
}