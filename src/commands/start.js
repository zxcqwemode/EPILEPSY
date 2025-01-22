const db = require('../config/db');
const { handleMenuCommand } = require('../handlers/doctorOfficeHandlerRussian');
const { handleMenuCommandEnglish } = require('../handlers/doctorOfficeHandlerEnglish');
const callbackMyProfileRussian = require('../handlers/myProfileRussian');
const callbackMyProfileEnglish = require('../handlers/myProfileEnglish');

module.exports = async function handleStartCommand(bot, msg) {
    const chatId = msg.chat.id;

    try {
        // Проверяем существование пользователя в обеих таблицах
        const userCheck = await db.query('SELECT * FROM users WHERE chat_id = $1', [chatId]);
        const doctorCheck = await db.query('SELECT * FROM doctors WHERE chat_id = $1', [chatId]);

        // Если пользователь существует как доктор
        if (doctorCheck.rows.length > 0) {
            const doctorLanguage = doctorCheck.rows[0].language;
            if (doctorLanguage === 'English') {
                await handleMenuCommandEnglish(bot, msg);
            } else {
                await handleMenuCommand(bot, msg);
            }
            return;
        }

        // Если пользователь существует как пациент
        if (userCheck.rows.length > 0) {
            const userLanguage = userCheck.rows[0].language;
            if (userLanguage === 'English') {
                await callbackMyProfileEnglish(bot, msg);
            } else {
                await callbackMyProfileRussian(bot, msg);
            }
            return;
        }

        // Если пользователь не существует, создаем новую запись
        await db.query('INSERT INTO users (chat_id, step) VALUES ($1, $2)',
            [chatId, 'language_choice']);

       console.log('New user with chat_id: ${chatId} added to database.');

        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Русский', callback_data: 'language_russian' },
                        { text: 'English', callback_data: 'language_english' },
                    ],
                ],
            },
        };

        // Отправляем приветственное сообщение
        await bot.sendMessage(chatId, 'Привет, я Эпилепсибот!\n' +
            'Помогаю отслеживать, когда, как и от чего у вас приступы эпилепсии\n' +
            '\n' +
            'Врачи рекомендуют вести такой дневник каждый день. Благодаря моим данным доктор быстро выяснит настоящую причину приступов и подберет лечение, которое будет работать.\n' +
            '\n' +
            'Выберите язык, чтобы я мог рассказать больше\n' +
            '\n' +
            'Если вы уже общались с моей предыдущей версией — не волнуйтесь, я сохранил все данные', options);

    } catch (err) {
        console.error('Error handling /start command:', err);
        await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте еще раз.');
    }
};